/**
 * Shared courier status sync — used by both supplier and admin actions.
 * Pulls the latest Steadfast delivery status and reflects it on the
 * forward + master order so everything stays visible in both panels.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  getSteadfastConfig,
  getSteadfastStatus,
  mapSteadfastStatus,
  steadfastStatusBn,
} from "@/lib/steadfast";

export type SyncResult = {
  ok: boolean;
  error?: string;
  status?: string;
  changed?: boolean;
  message?: string;
};

export async function syncForwardCourierStatus(
  forwardId: string,
  actor: string
): Promise<SyncResult> {
  const so = await prisma.supplierOrder.findUnique({
    where: { id: forwardId },
    include: { order: true },
  });
  if (!so) return { ok: false, error: "Forward পাওয়া যায়নি।" };
  if (so.courierProvider !== "STEADFAST" || (!so.consignmentId && !so.trackingId)) {
    return {
      ok: false,
      error: "Auto-sync শুধু Steadfast booking-এ কাজ করে।",
    };
  }
  if (["DELIVERED", "RETURNED", "CANCELLED"].includes(so.status)) {
    return {
      ok: false,
      error: `এই forward ইতিমধ্যে ${so.status} — sync দরকার নেই।`,
    };
  }

  // Supplier's own Steadfast credential wins, else the global merchant account
  const ownCred = await prisma.courierCredential.findUnique({
    where: {
      supplierId_provider: { supplierId: so.supplierId, provider: "STEADFAST" },
    },
  });
  const config = await getSteadfastConfig(
    ownCred
      ? {
          apiKey: ownCred.apiKey,
          secretKey: ownCred.apiSecret ?? "",
          baseUrl: ownCred.baseUrl ?? "",
        }
      : undefined
  );

  let st;
  try {
    st = await getSteadfastStatus(
      config,
      {
        consignmentId: so.consignmentId,
        trackingCode: so.trackingId,
        invoice: so.order.invoiceNumber ?? so.order.orderNumber,
      },
      so.shippedAt
    );
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Status check failed",
    };
  }

  const outcome = mapSteadfastStatus(st.delivery_status);
  const prevRaw = so.courierStatus ?? "";
  const changed = prevRaw !== st.delivery_status;
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.supplierOrder.update({
      where: { id: so.id },
      data: { courierStatus: st.delivery_status, statusCheckedAt: now },
    });

    if (outcome === "delivered" && so.status === "SHIPPED") {
      // Courier confirms delivery → complete everything + credit margin
      const margin =
        so.order.subtotal - so.supplierCost + so.order.deliveryFee;
      await tx.supplierOrder.update({
        where: { id: so.id },
        data: { status: "DELIVERED", deliveredAt: now },
      });
      await tx.order.update({
        where: { id: so.orderId },
        data: { status: "DELIVERED", paymentStatus: "PAID" },
      });
      await tx.supplierLedger.create({
        data: {
          supplierId: so.supplierId,
          type: "EARNING",
          amount: margin,
          orderId: so.orderId,
          note: "Delivered (courier sync) — reseller margin due",
          actor,
        },
      });
      await tx.orderStatusLog.create({
        data: {
          orderId: so.orderId,
          from: "SHIPPED",
          to: "DELIVERED",
          actor: `courier-sync(${actor})`,
          note: `Steadfast: ${st.delivery_status}`,
        },
      });
    } else if (outcome === "returned" && so.status === "SHIPPED") {
      await tx.supplierOrder.update({
        where: { id: so.id },
        data: { status: "RETURNED" },
      });
      await tx.order.update({
        where: { id: so.orderId },
        data: { status: "RETURNED" },
      });
      await tx.orderStatusLog.create({
        data: {
          orderId: so.orderId,
          from: "SHIPPED",
          to: "RETURNED",
          actor: `courier-sync(${actor})`,
          note: `Steadfast: ${st.delivery_status}`,
        },
      });
    }

    // Always leave an audit trail so admin can see every check
    await tx.auditLog.create({
      data: {
        orderId: so.orderId,
        action: "COURIER_SYNC",
        field: "courierStatus",
        oldValue: prevRaw || "—",
        newValue: `${st.delivery_status}${st.test ? " (TEST)" : ""}`,
        actor,
      },
    });
  });

  revalidatePath(`/admin/orders/${so.orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath(`/supplier/orders/${so.orderId}`);
  revalidatePath("/supplier/orders");
  revalidatePath("/track");

  // Courier-truth conversions (server-side, never throws, idempotent).
  // Delivered = REAL purchase → Meta/Google/TikTok with actual COD value.
  // Returned = take it back → NO purchase, cancel signals only.
  if (outcome === "delivered" && so.status === "SHIPPED") {
    const { fireDeliveredConversions } = await import("@/lib/conversions");
    await fireDeliveredConversions(so.orderId, so.order.total);
  } else if (outcome === "returned" && so.status === "SHIPPED") {
    const { fireCancelledConversions } = await import("@/lib/conversions");
    await fireCancelledConversions(so.orderId);
  }

  const bn = steadfastStatusBn(st.delivery_status);
  return {
    ok: true,
    status: st.delivery_status,
    changed,
    message:
      outcome === "delivered" && so.status === "SHIPPED"
        ? `🎉 ডেলিভারড! Order complete + margin হিসাব হয়েছে।`
        : outcome === "returned" && so.status === "SHIPPED"
          ? `↩️ রিটার্ন হয়েছে — status আপডেট করা হয়েছে।`
          : changed
            ? `Courier status: ${bn}`
            : `এখনো ${bn} — কোনো পরিবর্তন নেই।`,
  };
}
