"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { recordSupplierWithdrawal } from "@/lib/supplier";
import type { CourierProvider, SupplierOrderStatus } from "@prisma/client";

type Result = { ok: boolean; error?: string; message?: string; trackingId?: string; consignmentId?: string };

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

  // Courier-truth conversions: supplier-confirmed delivery/return.
  if (to === "DELIVERED") {
    const { fireDeliveredConversions } = await import("@/lib/conversions");
    await fireDeliveredConversions(orderId, so.order.total);
  } else if (to === "RETURNED") {
    const { fireCancelledConversions } = await import("@/lib/conversions");
    await fireCancelledConversions(orderId);
  }
  return { ok: true };
}

/* ------------------------------ book courier ------------------------------ */

/**
 * Book a courier for a forwarded order.
 *
 * STEADFAST: uses the merchant account from Admin → Settings (or the
 * supplier's own Steadfast credential if saved). Creates a real consignment
 * via API — in TEST mode a mock consignment is generated instead.
 * Other providers: manual tracking ID, or supplier's saved credential baseUrl.
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
    include: { order: { include: { items: true } } },
  });
  if (!so) return { ok: false, error: "Forward পাওয়া যায়নি।" };

  const cred = await prisma.courierCredential.findUnique({
    where: { supplierId_provider: { supplierId, provider } },
  });

  let trackingId = manualTrackingId?.trim() || "";
  let consignmentId = "";
  let testBooking = false;

  // --- Steadfast: automatic consignment via API ---
  if (!trackingId && provider === "STEADFAST") {
    try {
      const { getSteadfastConfig, createSteadfastOrder } = await import(
        "@/lib/steadfast"
      );
      const config = await getSteadfastConfig(
        cred
          ? {
              apiKey: cred.apiKey,
              secretKey: cred.apiSecret ?? "",
              baseUrl: cred.baseUrl ?? "",
            }
          : undefined
      );
      const booking = await createSteadfastOrder(config, {
        invoice: so.order.invoiceNumber || so.order.orderNumber,
        recipient_name: so.order.shipName,
        recipient_phone: so.order.shipPhone,
        recipient_address: [
          so.order.shipAddress,
          so.order.shipThana,
          so.order.shipDistrict,
        ]
          .filter(Boolean)
          .join(", "),
        cod_amount: (so.order.total - so.order.advancePaid) / 100,
        note: `${so.order.orderNumber} · ${so.order.items.length} pcs`,
      });
      trackingId = booking.tracking_code;
      consignmentId = String(booking.consignment_id);
      testBooking = booking.test;
    } catch (e) {
      return {
        ok: false,
        error:
          e instanceof Error
            ? e.message
            : "Steadfast booking failed। Manual tracking ID দিন।",
      };
    }
  }

  // --- Other providers: supplier credential baseUrl or manual ID ---
  if (!trackingId && cred && provider !== "STEADFAST") {
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
      }
    } catch {
      /* fall through to manual error below */
    }
  }

  if (!trackingId) {
    return {
      ok: false,
      error:
        provider === "STEADFAST"
          ? "Steadfast থেকে consignment পাওয়া যায়নি।"
          : `${provider} এর credential setup করুন, অথবা manual tracking ID দিন।`,
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
        courierStatus: testBooking ? "pending (TEST)" : "pending",
        shippedAt: new Date(),
        note: testBooking
          ? `${so.note ?? ""} [TEST booking — mock consignment]`.trim()
          : so.note,
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
    await tx.orderStatusLog.create({
      data: {
        orderId,
        from: "PROCESSING",
        to: "SHIPPED",
        actor: "supplier",
        note: testBooking
          ? `Steadfast TEST booking: ${trackingId}`
          : `Courier booked (${provider}): ${trackingId}`,
      },
    }).catch(() => {});
  });

  revalidatePath(`/supplier/orders/${orderId}`);
  revalidatePath("/supplier/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/track");
  return { ok: true, trackingId, consignmentId: consignmentId || undefined };
}

/* ------------------------------ courier sync ------------------------------ */

/**
 * Pull the latest Steadfast status for this forward and reflect it
 * on the order. Works for the supplier on their own forwards.
 */
export async function syncCourierStatus(orderId: string): Promise<Result> {
  let supplierId = "";
  let email = "supplier";
  try {
    ({ supplierId, email } = await requireSupplier());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const so = await prisma.supplierOrder.findFirst({
    where: { orderId, supplierId },
  });
  if (!so) return { ok: false, error: "Forward পাওয়া যায়নি।" };
  const { syncForwardCourierStatus } = await import("@/lib/courier-sync");
  const res = await syncForwardCourierStatus(so.id, email);
  return { ok: res.ok, error: res.error, message: res.message };
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

/* --------------------------- telegram notifications ------------------------ */

/**
 * Supplier connects their own Telegram: forward + payment-request
 * notifications will arrive on this chat.
 */
export async function saveMyTelegram(chatId: string): Promise<Result> {
  let supplierId = "";
  try {
    ({ supplierId } = await requireSupplier());
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const clean = chatId.trim();
  if (clean && !/^-?\d+$/.test(clean)) {
    return { ok: false, error: "Chat ID শুধু সংখ্যা হবে।" };
  }
  await prisma.supplier.update({
    where: { id: supplierId },
    data: { telegramChatId: clean || null },
  });

  // Send a confirmation message (proves the connection works)
  if (clean) {
    const { sendTelegramTo } = await import("@/lib/telegram");
    const ok = await sendTelegramTo(
      clean,
      `✅ <b>Manza BD</b> — Telegram connected!\n\nনতুন forward ও payment request-এর notification এখানে আসবে।`
    );
    if (!ok) {
      return {
        ok: false,
        error:
          "Chat ID save হয়েছে, কিন্তু টেস্ট মেসেজ যায়নি। Bot-কে আগে Hi পাঠান, Chat ID ঠিক আছে কিনা দেখুন।",
      };
    }
  }
  revalidatePath("/supplier");
  return { ok: true, message: "Connected ✓ টেস্ট মেসেজ পাঠানো হয়েছে!" };
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
