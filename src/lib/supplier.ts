import { prisma } from "@/lib/prisma";

export type SupplierConfig = {
  basePrice: number;
  combo2Price: number;
  combo3Price: number;
};

/**
 * ACCOUNTING MODEL (reseller):
 *  - The SUPPLIER fulfils the order: ships via courier and collects COD cash
 *    from the customer. The supplier bears the courier cost.
 *  - The reseller (us) earns a MARGIN = (what we charged the customer for goods)
 *    minus (the supplier's cost for those goods), PLUS the delivery margin.
 *  - The supplier holds our margin until we withdraw it.
 *
 * Ledger:
 *  - EARNING    = reseller margin credited for a delivered order (supplier owes us)
 *  - WITHDRAWAL = money the supplier has transferred to us (reduces what they owe)
 *  - balance    = earned − withdrawn  → amount the supplier still owes us
 */
export async function getSupplierBalance(supplierId: string): Promise<{
  earned: number;
  withdrawn: number;
  balance: number;
}> {
  const [earn, wd, adj] = await Promise.all([
    prisma.supplierLedger.aggregate({
      _sum: { amount: true },
      where: { supplierId, type: "EARNING" },
    }),
    prisma.supplierLedger.aggregate({
      _sum: { amount: true },
      where: { supplierId, type: "WITHDRAWAL" },
    }),
    prisma.supplierLedger.aggregate({
      _sum: { amount: true },
      where: { supplierId, type: "ADJUSTMENT" },
    }),
  ]);
  const earned = earn._sum.amount ?? 0;
  const withdrawn = wd._sum.amount ?? 0;
  const adjustment = adj._sum.amount ?? 0;
  return { earned, withdrawn, balance: earned - withdrawn + adjustment };
}

/** Credit the reseller's margin for a delivered order (supplier now owes us). */
export async function creditResellerMargin(
  supplierId: string,
  amount: number,
  orderId: string,
  note: string,
  actor = "system"
) {
  await prisma.supplierLedger.create({
    data: { supplierId, type: "EARNING", amount, orderId, note, actor },
  });
}

/** Record a withdrawal received from the supplier (reduces what they owe). */
export async function recordSupplierWithdrawal(
  supplierId: string,
  amount: number,
  orderId: string | null,
  note: string,
  actor = "system"
) {
  await prisma.supplierLedger.create({
    data: { supplierId, type: "WITHDRAWAL", amount, orderId, note, actor },
  });
}

/**
 * Compute the reseller's margin for a delivered order.
 * goodsMargin = (customer goods price) − (supplier cost)
 * deliveryMargin = delivery fee charged to customer (supplier pays courier)
 */
export function computeMargin(order: {
  subtotal: number;
  deliveryFee: number;
  supplierCost: number;
}) {
  const goodsMargin = order.subtotal - order.supplierCost;
  const deliveryMargin = order.deliveryFee;
  return { goodsMargin, deliveryMargin, total: goodsMargin + deliveryMargin };
}

/** Aggregate reseller margin across all delivered orders. */
export async function getMarginSummary() {
  const orders = await prisma.order.findMany({
    where: { status: "DELIVERED" },
    select: { subtotal: true, deliveryFee: true, supplierCost: true, total: true },
  });
  let goodsMargin = 0;
  let deliveryMargin = 0;
  let cost = 0;
  for (const o of orders) {
    goodsMargin += o.subtotal - o.supplierCost;
    deliveryMargin += o.deliveryFee;
    cost += o.supplierCost;
  }
  return {
    goodsMargin,
    deliveryMargin,
    margin: goodsMargin + deliveryMargin,
    cost,
    deliveredOrders: orders.length,
  };
}

/** Total amount suppliers currently owe the reseller. */
export async function getTotalReceivable() {
  const suppliers = await prisma.supplier.findMany({ select: { id: true } });
  let total = 0;
  for (const s of suppliers) {
    const { balance } = await getSupplierBalance(s.id);
    total += balance;
  }
  return total;
}
