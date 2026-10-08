/**
 * Shared courier status sync — used by both supplier and admin actions.
 * Pulls the latest Steadfast delivery status AND the final collected
 * amount, then reflects everything automatically:
 *  - courier status + last-checked time on the forward
 *  - codCollected on the order + auto audit note when it differs
 *  - margin credited/adjusted from the CANONICAL formula
 *      margin = collected − supplier cost (per-pc on partial)
 *  - delivered/returned transitions + courier-truth conversions
 * Fully automated — no manual calculation anywhere.
 */
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  getSteadfastConfig,
  getSteadfastStatus,
  mapSteadfastStatus,
  steadfastStatusBn,
} from "@/lib/steadfast";
import { computeMargin } from "@/lib/supplier";
import { formatBDT } from "@/lib/utils";

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
    include: { order: { include: { items: true } } },
  });
  if (!so) return { ok: false, error: "Forward পাওয়া যায়নি।" };
  if (so.courierProvider !== "STEADFAST" || (!so.consignmentId && !so.trackingId)) {
    return {
      ok: false,
      error: "Auto-sync শুধু Steadfast booking-এ কাজ করে।",
    };
  }
  // Terminal forwards still sync MONEY (collected amount can update later),
  // only status transitions are skipped — except RETURNED/CANCELLED.
  if (["RETURNED", "CANCELLED"].includes(so.status)) {
    return {
      ok: false,
      error: `এই forward ${so.status} — sync দরকার নেই।`,
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
      so.shippedAt,
      so.order.total
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
  const totalPcs = so.order.items.reduce((s, i) => s + i.quantity, 0);

  // Canonical money math for THIS sync
  const newCollected = st.collected ?? null;
  const isFinal = outcome === "delivered" || outcome === "returned";
  const prevCollected = so.order.codCollected > 0 ? so.order.codCollected : so.order.total;
  // Report money when: courier's number differs, OR first final confirmation
  // (codCollectedAt null). Plain in-transit syncs with unchanged totals stay quiet.
  const collectedChanged =
    newCollected != null &&
    (so.order.codCollectedAt == null ? isFinal : newCollected !== so.order.codCollected);
  const newDeliveredPcs =
    st.deliveredQty != null && st.deliveredQty < totalPcs ? st.deliveredQty : null;
  const pcsChanged = newDeliveredPcs != null && newDeliveredPcs !== so.deliveredPcs;

  let marginNote = "";

  await prisma.$transaction(async (tx) => {
    const forwardData: Record<string, unknown> = {
      courierStatus: st.delivery_status,
      statusCheckedAt: now,
    };
    if (pcsChanged) forwardData.deliveredPcs = newDeliveredPcs;
    await tx.supplierOrder.update({ where: { id: so.id }, data: forwardData });

    // --- courier money: auto-update collected + auto note ---
    const effectiveCollected =
      newCollected ?? (so.order.codCollected > 0 ? so.order.codCollected : so.order.total);
    if (collectedChanged) {
      await tx.order.update({
        where: { id: so.orderId },
        data: { codCollected: newCollected!, codCollectedAt: now },
      });
      await tx.auditLog.create({
        data: {
          orderId: so.orderId,
          action: "COURIER_COLLECTED",
          field: "codCollected",
          oldValue: formatBDT(
            so.order.codCollected > 0 ? so.order.codCollected : so.order.total
          ),
          newValue: formatBDT(newCollected!),
          actor: `courier-sync(${actor})`,
          reason: `Courier final: ${st.delivery_status}${st.test ? " (TEST)" : ""}`,
        },
      });
    }
    if (pcsChanged) {
      await tx.auditLog.create({
        data: {
          orderId: so.orderId,
          action: "COURIER_PARTIAL",
          field: "deliveredPcs",
          oldValue: `${totalPcs} pcs`,
          newValue: `${newDeliveredPcs} pcs (per-pc cost adjusted)`,
          actor: `courier-sync(${actor})`,
        },
      });
    }

    const canonical = (deliveredPcs: number | null) =>
      computeMargin({
        subtotal: so.order.subtotal,
        deliveryFee: so.order.deliveryFee,
        supplierCost: so.order.supplierCost,
        codCollected: effectiveCollected,
        total: so.order.total,
        deliveredPcs,
        totalPcs,
      });

    if (outcome === "delivered" && so.status === "SHIPPED") {
      // Courier confirms delivery → complete everything + credit margin
      const m = canonical(newDeliveredPcs ?? so.deliveredPcs);
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
          amount: m.total,
          orderId: so.orderId,
          note: `Delivered (courier sync) — collected ${formatBDT(m.collected)}, margin due`,
          actor,
        },
      });
      await tx.orderStatusLog.create({
        data: {
          orderId: so.orderId,
          from: "SHIPPED",
          to: "DELIVERED",
          actor: `courier-sync(${actor})`,
          note: `Steadfast: ${st.delivery_status}, collected ${formatBDT(m.collected)}`,
        },
      });
      marginNote = `Collected ${formatBDT(m.collected)} → margin ${formatBDT(m.total)}`;
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
    } else if (so.status === "DELIVERED" && (collectedChanged || pcsChanged)) {
      // Already delivered, but courier's FINAL number moved → auto-adjust
      const m = canonical(newDeliveredPcs ?? so.deliveredPcs);
      const credited = await tx.supplierLedger.aggregate({
        _sum: { amount: true },
        where: { supplierId: so.supplierId, type: "EARNING", orderId: so.orderId },
      });
      const diff = m.total - (credited._sum.amount ?? 0);
      if (diff !== 0) {
        await tx.supplierLedger.create({
          data: {
            supplierId: so.supplierId,
            type: "ADJUSTMENT",
            amount: diff,
            orderId: so.orderId,
            note: `Courier final update — collected ${formatBDT(m.collected)}, margin now ${formatBDT(m.total)}`,
            actor: `courier-sync(${actor})`,
          },
        });
        await tx.auditLog.create({
          data: {
            orderId: so.orderId,
            action: "MARGIN_ADJUSTED",
            field: "margin",
            oldValue: formatBDT(credited._sum.amount ?? 0),
            newValue: formatBDT(m.total),
            actor: `courier-sync(${actor})`,
          },
        });
        marginNote = `Updated total ${formatBDT(m.collected)} → margin adjusted ${formatBDT(diff)}`;
      }
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
  if (outcome === "delivered" && so.status === "SHIPPED") {
    const { fireDeliveredConversions } = await import("@/lib/conversions");
    const m = computeMargin({
      subtotal: so.order.subtotal,
      deliveryFee: so.order.deliveryFee,
      supplierCost: so.order.supplierCost,
      codCollected: newCollected ?? undefined,
      total: so.order.total,
      deliveredPcs: newDeliveredPcs ?? so.deliveredPcs,
      totalPcs,
    });
    await fireDeliveredConversions(so.orderId, m.collected);
  } else if (outcome === "returned" && so.status === "SHIPPED") {
    const { fireCancelledConversions } = await import("@/lib/conversions");
    await fireCancelledConversions(so.orderId);
  }

  const bn = steadfastStatusBn(st.delivery_status);
  const bits: string[] = [];
  if (collectedChanged) bits.push(`তুলেছে ${formatBDT(newCollected!)}`);
  if (pcsChanged) bits.push(`${newDeliveredPcs} pcs delivered`);
  if (marginNote) bits.push(marginNote);
  return {
    ok: true,
    status: st.delivery_status,
    changed: changed || collectedChanged || pcsChanged,
    message:
      outcome === "delivered" && so.status === "SHIPPED"
        ? `🎉 ডেলিভারড! ${bits.join(" · ") || "margin হিসাব হয়েছে।"}`
        : outcome === "returned" && so.status === "SHIPPED"
          ? `↩️ রিটার্ন হয়েছে — status আপডেট করা হয়েছে।`
          : bits.length > 0
            ? `Courier update: ${bits.join(" · ")}`
            : changed
              ? `Courier status: ${bn}`
              : `এখনো ${bn} — কোনো পরিবর্তন নেই।`,
  };
}
