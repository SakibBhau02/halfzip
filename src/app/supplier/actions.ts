"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordSupplierWithdrawal } from "@/lib/supplier";
import type { CourierProvider, SupplierOrderStatus } from "@prisma/client";

type Result = { ok: boolean; error?: string; trackingId?: string };

async function requireSupplier() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const supplierId = (session?.user as { supplierId?: string } | undefined)
    ?.supplierId;
  if (!session || role !== "SUPPLIER" || !supplierId) throw new Error("Unauthorized");
  return { supplierId, email: session.user?.email ?? "supplier" };
}

const NEXT: Record<SupplierOrderStatus, SupplierOrderStatus[]> = {
  PENDING: ["ACCEPTED", "CANCELLED"],
  ACCEPTED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED"],
  SHIPPED: ["DELIVERED", "RETURNED"],
  DELIVERED: [],
  RETURNED: [],
  CANCELLED: [],
};

export async function updateSupplierOrderStatus(
  orderId: string,
  to: SupplierOrderStatus,
  note?: string
): Promise<Result> {
  let supplierId = "";
  try {
    ({ supplierId } = await requireSupplier());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const so = await prisma.supplierOrder.findFirst({
    where: { orderId, supplierId },
    include: { order: true },
  });
  if (!so) return { ok: false, error: "Forward পাওয়া যায়নি।" };
  if (!NEXT[so.status].includes(to)) {
    return { ok: false, error: `Cannot move from ${so.status} to ${to}` };
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.supplierOrder.update({
      where: { id: so.id },
      data: {
        status: to,
        note: note || so.note,
        acceptedAt: to === "ACCEPTED" ? now : so.acceptedAt,
        shippedAt: to === "SHIPPED" ? now : so.shippedAt,
        deliveredAt: to === "DELIVERED" ? now : so.deliveredAt,
      },
    });
    // Reflect on the master order lifecycle too
    if (to === "ACCEPTED") {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "CONFIRMED" },
      });
    } else if (to === "SHIPPED") {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "SHIPPED" },
      });
    } else if (to === "DELIVERED") {
      await tx.order.update({
        where: { id: orderId },
        data: { status: "DELIVERED", paymentStatus: "PAID" },
      });
      // Credit the RESELLER's margin: supplier collected COD, now owes us our cut.
      const margin =
        so.order.subtotal -
        so.supplierCost +
        so.order.deliveryFee;
      await tx.supplierLedger.create({
        data: {
          supplierId,
          type: "EARNING",
          amount: margin,
          orderId,
          note: "Delivered — reseller margin due",
          actor: "supplier",
        },
      });
    } else if (to === "RETURNED") {
      await tx.order.update({ where: { id: orderId }, data: { status: "RETURNED" } });
    } else if (to === "CANCELLED") {
      await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED" } });
    }
    await tx.orderStatusLog.create({
      data: { orderId, to: to === "ACCEPTED" ? "CONFIRMED" : to === "SHIPPED" ? "SHIPPED" : to === "DELIVERED" ? "DELIVERED" : to === "CANCELLED" ? "CANCELLED" : to === "RETURNED" ? "RETURNED" : "CONFIRMED", from: so.status === "PENDING" ? "NEW" : null, actor: "supplier", note: `Supplier: ${to}` },
    }).catch(() => {});
  });

  revalidatePath(`/supplier/orders/${orderId}`);
  revalidatePath("/supplier/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

/* ------------------------------ book courier ------------------------------ */

/**
 * Book a courier using the supplier's saved credentials.
 * NOTE: Real Pathao/RedX/Steadfast booking requires their live API +
 * a verified pickup store. This creates the booking record and (where a
 * baseUrl + apiKey exist) attempts a real POST; on failure it still saves
 * the tracking locally so the supplier can enter a manual tracking code.
 */
export async function bookCourier(
  orderId: string,
  provider: CourierProvider,
  manualTrackingId?: string
): Promise<Result> {
  let supplierId = "";
  try {
    ({ supplierId } = await requireSupplier());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const so = await prisma.supplierOrder.findFirst({
    where: { orderId, supplierId },
    include: { order: true },
  });
  if (!so) return { ok: false, error: "Forward পাওয়া যায়নি।" };

  const cred = await prisma.courierCredential.findUnique({
    where: { supplierId_provider: { supplierId, provider } },
  });
  if (!cred && !manualTrackingId) {
    return {
      ok: false,
      error: `${provider} এর credential setup করুন, অথবা manual tracking ID দিন।`,
    };
  }

  let trackingId = manualTrackingId?.trim() || "";
  let consignmentId = "";
  let apiNote = "";

  // Attempt a real API call only if a baseUrl is provided
  if (!trackingId && cred) {
    try {
      const res = await fetch(`${cred.baseUrl || ""}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cred.apiKey}`,
        },
        body: JSON.stringify({
          merchant_order_id: so.order.orderNumber,
          recipient_name: so.order.shipName,
          recipient_phone: so.order.shipPhone,
          recipient_address: so.order.shipAddress,
          cod_amount: so.order.total - so.order.advancePaid,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        trackingId = data.tracking_id ?? data.tracking_code ?? "";
        consignmentId = data.consignment_id ?? data.id ?? "";
      } else {
        apiNote = "Courier API rejected — tracking saved manually.";
      }
    } catch {
      apiNote = "Courier API unreachable — tracking saved manually.";
    }
  }

  if (!trackingId) {
    return {
      ok: false,
      error: apiNote || "Tracking ID পাওয়া যায়নি। Manual ID দিন।",
    };
  }

  await prisma.$transaction(async (tx) => {
    await tx.supplierOrder.update({
      where: { id: so.id },
      data: {
        status: "SHIPPED",
        courierProvider: provider,
        trackingId,
        consignmentId: consignmentId || null,
        shippedAt: new Date(),
      },
    });
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: "SHIPPED",
        courierName: provider,
        trackingId,
      },
    });
  });

  revalidatePath(`/supplier/orders/${orderId}`);
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true, trackingId };
}

/* --------------------------- courier credentials -------------------------- */

export async function saveCourierCredential(input: {
  provider: CourierProvider;
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
}): Promise<Result> {
  let supplierId = "";
  try {
    ({ supplierId } = await requireSupplier());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!input.apiKey.trim()) return { ok: false, error: "API Key দরকার।" };

  await prisma.courierCredential.upsert({
    where: { supplierId_provider: { supplierId, provider: input.provider } },
    update: {
      apiKey: input.apiKey,
      apiSecret: input.apiSecret || null,
      baseUrl: input.baseUrl || null,
      active: true,
    },
    create: {
      supplierId,
      provider: input.provider,
      apiKey: input.apiKey,
      apiSecret: input.apiSecret || null,
      baseUrl: input.baseUrl || null,
    },
  });
  revalidatePath("/supplier/courier");
  return { ok: true };
}

export async function deleteCourierCredential(
  provider: CourierProvider
): Promise<Result> {
  let supplierId = "";
  try {
    ({ supplierId } = await requireSupplier());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  await prisma.courierCredential.deleteMany({ where: { supplierId, provider } });
  revalidatePath("/supplier/courier");
  return { ok: true };
}

/* ------------------------------- withdrawals ------------------------------ */

/**
 * Supplier confirms they have transferred the requested margin to the reseller.
 * Marks the payout RECEIVED and posts a WITHDRAWAL ledger entry (reduces what
 * the supplier owes the reseller).
 */
export async function markWithdrawalSent(
  payoutId: string,
  reference: string
): Promise<Result> {
  let supplierId = "";
  try {
    ({ supplierId } = await requireSupplier());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const payout = await prisma.supplierPayout.findFirst({
    where: { id: payoutId, supplierId },
  });
  if (!payout) return { ok: false, error: "Request পাওয়া যায়নি।" };
  if (payout.status === "RECEIVED") return { ok: false, error: "Already done." };
  if (payout.status === "REJECTED")
    return { ok: false, error: "Request rejected হয়েছে।" };

  await prisma.$transaction([
    prisma.supplierPayout.update({
      where: { id: payoutId },
      data: { status: "RECEIVED", paidAt: new Date(), reference: reference || null },
    }),
    prisma.supplierLedger.create({
      data: {
        supplierId,
        type: "WITHDRAWAL",
        amount: payout.amount,
        note: `Withdrawal sent (${payout.method}) ${reference}`,
        actor: "supplier",
      },
    }),
  ]);

  revalidatePath("/supplier/earnings");
  revalidatePath("/admin/accounting");
  return { ok: true };
}
