"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { canTransition } from "@/lib/order-status";
import type { OrderStatus, PaymentStatus } from "@prisma/client";

type Result = { ok: boolean; error?: string; message?: string };

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") throw new Error("Unauthorized");
  return session.user?.email ?? "admin";
}

export async function updateOrderStatus(
  orderId: string,
  to: OrderStatus,
  note?: string
): Promise<Result> {
  let actor = "admin";
  try {
    actor = await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Order not found" };
  if (order.status === to) return { ok: false, error: "Already in this status" };
  if (!canTransition(order.status, to)) {
    return {
      ok: false,
      error: `Cannot move from ${order.status} to ${to}`,
    };
  }

  await prisma.$transaction([
    prisma.order.update({
      where: { id: orderId },
      data: {
        status: to,
        paymentStatus:
          to === "DELIVERED"
            ? ("PAID" as PaymentStatus)
            : order.paymentStatus,
      },
    }),
    prisma.orderStatusLog.create({
      data: {
        orderId,
        from: order.status,
        to,
        actor,
        note: note || null,
      },
    }),
    prisma.auditLog.create({
      data: {
        orderId,
        action: "STATUS_CHANGED",
        field: "status",
        oldValue: order.status,
        newValue: to,
        actor,
        reason: note || null,
      },
    }),
  ]);

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");

  // Courier-truth conversions on manual status changes too.
  if (to === "DELIVERED") {
    const { fireDeliveredConversions } = await import("@/lib/conversions");
    await fireDeliveredConversions(orderId, order.total);
  } else if (to === "RETURNED" || to === "CANCELLED") {
    const { fireCancelledConversions } = await import("@/lib/conversions");
    await fireCancelledConversions(orderId);
  }
  return { ok: true };
}

export async function updateTracking(
  orderId: string,
  courierName: string,
  trackingId: string
): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  await prisma.order.update({
    where: { id: orderId },
    data: { courierName: courierName || null, trackingId: trackingId || null },
  });
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

export async function updateOrderNotes(
  orderId: string,
  notes: string
): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  await prisma.order.update({
    where: { id: orderId },
    data: { notes },
  });
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

/* --------------------------- create / edit order -------------------------- */

export type OrderFormInput = {
  customerName: string;
  phone: string;
  address: string;
  district: string;
  notes: string;
  zone: "inside" | "outside";
  variantId: string;
  extraVariantIds?: string[];
  quantity: number;
  status: OrderStatus;
  paymentMethod: "COD" | "BKASH" | "NAGAD" | "ROCKET" | "BANK_TRANSFER";
  paymentStatus: "UNPAID" | "PAID" | "REFUNDED";
};

function validate(input: OrderFormInput): string | null {
  if (!input.customerName || input.customerName.trim().length < 2)
    return "Customer name দরকার।";
  if (!/^01[3-9]\d{8}$/.test(input.phone))
    return "সঠিক মোবাইল নাম্বার দিন (01XXXXXXXXX)।";
  if (!input.address || input.address.trim().length < 3) return "ঠিকানা দরকার।";
  if (!input.variantId) return "Product variant নির্বাচন করুন।";
  if (!input.quantity || input.quantity < 1) return "Quantity কমপক্ষে ১ হবে।";
  return null;
}

export async function createOrder(
  input: OrderFormInput
): Promise<{ ok: boolean; error?: string; id?: string }> {
  let actor = "admin";
  try {
    actor = await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const err = validate(input);
  if (err) return { ok: false, error: err };

  const allIds = [input.variantId, ...(input.extraVariantIds ?? [])];
  const variants = await prisma.productVariant.findMany({
    where: { id: { in: allIds } },
    include: { product: true },
  });
  if (variants.length !== allIds.length) {
    return { ok: false, error: "কিছু variant পাওয়া যায়নি।" };
  }
  const product = variants[0].product;

  const { comboSubtotal, comboDelivery } = await import("@/lib/combo");
  const cfg = {
    basePrice: product.basePrice,
    combo2Price: product.combo2Price,
    combo3Price: product.combo3Price,
    freeDeliveryAt: product.freeDeliveryAt,
    insideFee: product.insideFee,
    outsideFee: product.outsideFee,
  };
  const qty = allIds.length;
  const subtotal = comboSubtotal(cfg, qty);
  const deliveryFee = comboDelivery(cfg, qty, input.zone);
  const total = subtotal + deliveryFee;
  const perItem = Math.round(subtotal / qty);

  try {
    const order = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { phone: input.phone },
        update: {
          name: input.customerName,
          address: input.address,
          district: input.district || null,
        },
        create: {
          phone: input.phone,
          name: input.customerName,
          address: input.address,
          district: input.district || null,
        },
      });

      const count = await tx.order.count();
      const orderNumber = `HZ-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${String(
        count + 1
      ).padStart(4, "0")}`;
      const invCount = await tx.order.count({
        where: { invoiceNumber: { not: null } },
      });
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(
        invCount + 1
      ).padStart(5, "0")}`;

      const created = await tx.order.create({
        data: {
          orderNumber,
          invoiceNumber,
          customerId: customer.id,
          status: input.status,
          paymentMethod: input.paymentMethod,
          paymentStatus: input.paymentStatus,
          source: "manual",
          subtotal,
          deliveryFee,
          total,
          shipName: input.customerName,
          shipPhone: input.phone,
          shipAddress: input.address,
          shipDistrict: input.district || null,
          notes: input.notes || null,
          items: {
            create: variants.map((v) => ({
              variantId: v.id,
              quantity: 1,
              unitPrice: perItem,
              productName: v.product.name,
              variantLabel: `${v.color} / ${v.size}`,
            })),
          },
          statusHistory: {
            create: { to: input.status, actor, note: `Manually created (${qty} pcs)` },
          },
        },
      });

      return created;
    });

    // fire Telegram notification (non-blocking failure)
    const { sendTelegram, formatOrderTelegram } = await import("@/lib/telegram");
    const { formatBDT } = await import("@/lib/utils");
    await sendTelegram(
      formatOrderTelegram({
        orderNumber: order.orderNumber,
        name: input.customerName,
        phone: input.phone,
        address: input.address,
        district: input.district,
        color: variants.map((v) => `${v.color}/${v.size}`).join(", "),
        size: `${qty} পিস`,
        quantity: qty,
        total: formatBDT(total),
        delivery: deliveryFee === 0 ? "ফ্রি" : formatBDT(deliveryFee),
        source: "manual",
      })
    );

    revalidatePath("/admin/orders");
    revalidatePath("/admin");
    return { ok: true, id: order.id };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Order তৈরি করা যায়নি।" };
  }
}

export async function updateOrderDetails(
  orderId: string,
  input: {
    customerName: string;
    phone: string;
    address: string;
    district: string;
    notes: string;
    zone: "inside" | "outside";
  }
): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!/^01[3-9]\d{8}$/.test(input.phone))
    return { ok: false, error: "সঠিক মোবাইল নাম্বার দিন।" };

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return { ok: false, error: "Order not found" };

  const product = await prisma.product.findFirst();
  const deliveryFee = product
    ? input.zone === "inside"
      ? product.insideFee
      : product.outsideFee
    : order.deliveryFee;
  const subtotal = order.items.reduce(
    (s, i) => s + i.unitPrice * i.quantity,
    0
  );

  await prisma.order.update({
    where: { id: orderId },
    data: {
      shipName: input.customerName,
      shipPhone: input.phone,
      shipAddress: input.address,
      shipDistrict: input.district || null,
      notes: input.notes || null,
      deliveryFee,
      subtotal,
      total: subtotal + deliveryFee,
    },
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  return { ok: true };
}

export async function deleteOrder(orderId: string): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return { ok: false, error: "Order not found" };

  await prisma.$transaction(async (tx) => {
    // restore stock
    for (const item of order.items) {
      if (item.variantId) {
        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
      }
    }
    await tx.order.delete({ where: { id: orderId } });
  });

  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  return { ok: true };
}

/* ----------------------- payment & courier tracking ----------------------- */

async function logAudit(
  orderId: string,
  actor: string,
  action: string,
  field?: string,
  oldValue?: string,
  newValue?: string
) {
  await prisma.auditLog.create({
    data: { orderId, actor, action, field, oldValue, newValue },
  });
}

export async function recordCodCollected(
  orderId: string,
  amount: number
): Promise<Result> {
  let actor = "admin";
  try {
    actor = await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Order not found" };
  if (amount < 0) return { ok: false, error: "Amount invalid" };

  await prisma.order.update({
    where: { id: orderId },
    data: {
      codCollected: amount,
      codCollectedAt: new Date(),
      paymentStatus: amount >= order.total ? "PAID" : order.paymentStatus,
    },
  });
  await logAudit(
    orderId,
    actor,
    "COD_COLLECTED",
    "codCollected",
    String(order.codCollected),
    String(amount)
  );
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

export async function recordAdvancePaid(
  orderId: string,
  amount: number
): Promise<Result> {
  let actor = "admin";
  try {
    actor = await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Order not found" };
  if (amount < 0 || amount > order.total)
    return { ok: false, error: "Amount must be between 0 and total" };

  await prisma.order.update({
    where: { id: orderId },
    data: {
      advancePaid: amount,
      paymentStatus: amount >= order.total ? "PAID" : "UNPAID",
    },
  });
  await logAudit(
    orderId,
    actor,
    "ADVANCE_PAID",
    "advancePaid",
    String(order.advancePaid),
    String(amount)
  );
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

export async function updateCourier(
  orderId: string,
  input: {
    courierName: string;
    courierService: string;
    trackingId: string;
    trackingUrl: string;
  }
): Promise<Result> {
  let actor = "admin";
  try {
    actor = await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Order not found" };

  await prisma.order.update({
    where: { id: orderId },
    data: {
      courierName: input.courierName || null,
      courierService: input.courierService || null,
      trackingId: input.trackingId || null,
      trackingUrl: input.trackingUrl || null,
    },
  });
  await logAudit(
    orderId,
    actor,
    "COURIER_UPDATED",
    "courierName",
    order.courierName ?? "",
    input.courierName
  );
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

export async function recordPrint(orderId: string): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  await prisma.order.update({
    where: { id: orderId },
    data: { printCount: { increment: 1 }, lastPrintedAt: new Date() },
  });
  return { ok: true };
}

/** Assign a sequential invoice number if not present. */export async function ensureInvoiceNumber(orderId: string): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, error: "Order not found" };
  if (order.invoiceNumber) return { ok: true };

  const count = await prisma.order.count({
    where: { invoiceNumber: { not: null } },
  });
  const y = new Date().getFullYear();
  const invoiceNumber = `INV-${y}-${String(count + 1).padStart(5, "0")}`;
  await prisma.order.update({ where: { id: orderId }, data: { invoiceNumber } });
  revalidatePath(`/admin/orders/${orderId}`);
  return { ok: true };
}

/* ------------------------------ courier sync ------------------------------ */

/**
 * Admin pulls the latest Steadfast status for an order's forward.
 * Supplier status changes + courier updates all become visible here.
 */
export async function syncOrderCourierStatus(
  orderId: string
): Promise<Result> {
  let actor = "admin";
  try {
    actor = await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const so = await prisma.supplierOrder.findUnique({ where: { orderId } });
  if (!so) return { ok: false, error: "এই order supplier-এর কাছে forward করা হয়নি।" };
  const { syncForwardCourierStatus } = await import("@/lib/courier-sync");
  const res = await syncForwardCourierStatus(so.id, actor);
  return { ok: res.ok, error: res.error, message: res.message };
}
