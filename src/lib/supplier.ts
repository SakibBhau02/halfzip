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

export type RateCardRow = {
  productId: string;
  productName: string;
  /** what the customer pays per piece (retail) */
  retail: number;
  /** what the supplier charges per piece (cost) */
  cost: number;
  /** reseller profit per piece */
  perPcMargin: number;
};

/**
 * Rate card for a supplier: retail vs cost vs per-piece margin.
 * Same numbers shown to both admin and supplier so the deal is transparent.
 */
export async function getSupplierRateCard(
  supplierId: string
): Promise<RateCardRow[]> {
  const [products, costs] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.supplierProductCost.findMany({ where: { supplierId } }),
  ]);
  const costByProduct = Object.fromEntries(
    costs.map((c) => [c.productId, c.costPrice])
  );
  return products.map((p) => {
    const cost = costByProduct[p.id] ?? p.basePrice;
    return {
      productId: p.id,
      productName: p.name,
      retail: p.basePrice,
      cost,
      perPcMargin: p.basePrice - cost,
    };
  });
}

export type ForwardBreakdown = {
  /** goods retail (what customer pays for items) */
  retail: number;
  /** supplier cost for the goods */
  cost: number;
  /** delivery fee charged to customer */
  delivery: number;
  /** reseller margin on this forward */
  margin: number;
  /** pieces in this forward */
  pcs: number;
  /** true once the margin has been credited (delivered) */
  credited: boolean;
};

/** Per-forward profit breakdown — identical math for admin & supplier views. */
export function getForwardBreakdown(f: {
  subtotal: number;
  deliveryFee: number;
  supplierCost: number;
  pcs: number;
  credited: boolean;
}): ForwardBreakdown {
  return {
    retail: f.subtotal,
    cost: f.supplierCost,
    delivery: f.deliveryFee,
    margin: f.subtotal - f.supplierCost + f.deliveryFee,
    pcs: f.pcs,
    credited: f.credited,
  };
}

/* ------------------------- account statement ------------------------- */

export type StatementLine = {
  id: string;
  date: Date;
  kind: "MARGIN" | "PAYMENT" | "ADJUSTMENT";
  /** order number for margins, payment reference/method for payments */
  ref: string;
  note: string;
  /** COD cash the supplier collected from the customer */
  collected: number;
  /** goods cost the supplier keeps */
  cost: number;
  /** delivery fee (supplier bears the courier cost) */
  delivery: number;
  /** reseller margin earned on this line (+) */
  margin: number;
  /** cash the supplier sent to the reseller (+) */
  paid: number;
  /** running balance: total margin owed minus total paid */
  balance: number;
};

export type SupplierStatement = {
  lines: StatementLine[];
  totals: {
    collected: number;
    cost: number;
    delivery: number;
    marginEarned: number;
    paid: number;
    balanceDue: number;
    orderCount: number;
    paymentCount: number;
  };
};

/**
 * Professional account statement between ONE supplier and the reseller.
 * Single source of truth — admin sees it as "receivable", the supplier
 * sees the SAME numbers as "payable". Running balance on every line.
 */
export async function getSupplierStatement(
  supplierId: string
): Promise<SupplierStatement> {
  const entries = await prisma.supplierLedger.findMany({
    where: { supplierId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const orderIds = entries
    .map((e) => e.orderId)
    .filter((id): id is string => !!id);
  const orders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: {
      id: true,
      orderNumber: true,
      subtotal: true,
      supplierCost: true,
      deliveryFee: true,
      total: true,
    },
  });
  const orderById = Object.fromEntries(orders.map((o) => [o.id, o]));

  const lines: StatementLine[] = [];
  let running = 0;
  for (const e of entries) {
    const o = e.orderId ? orderById[e.orderId] : undefined;
    if (e.type === "EARNING") {
      const collected = o?.total ?? 0;
      const cost = o?.supplierCost ?? 0;
      const delivery = o?.deliveryFee ?? 0;
      running += e.amount;
      lines.push({
        id: e.id,
        date: e.createdAt,
        kind: "MARGIN",
        ref: o?.orderNumber ?? "—",
        note: e.note ?? "Delivered order margin",
        collected,
        cost,
        delivery,
        margin: e.amount,
        paid: 0,
        balance: running,
      });
    } else if (e.type === "WITHDRAWAL") {
      running -= e.amount;
      lines.push({
        id: e.id,
        date: e.createdAt,
        kind: "PAYMENT",
        ref: e.note ?? "Payment",
        note: `Paid to reseller (${e.actor ?? "supplier"})`,
        collected: 0,
        cost: 0,
        delivery: 0,
        margin: 0,
        paid: e.amount,
        balance: running,
      });
    } else {
      running += e.amount;
      lines.push({
        id: e.id,
        date: e.createdAt,
        kind: "ADJUSTMENT",
        ref: o?.orderNumber ?? "Adjustment",
        note: e.note ?? "Adjustment",
        collected: 0,
        cost: 0,
        delivery: 0,
        margin: e.amount,
        paid: 0,
        balance: running,
      });
    }
  }

  const totals = {
    collected: lines.reduce((s, l) => s + l.collected, 0),
    cost: lines.reduce((s, l) => s + l.cost, 0),
    delivery: lines.reduce((s, l) => s + l.delivery, 0),
    marginEarned: lines.reduce((s, l) => s + l.margin, 0),
    paid: lines.reduce((s, l) => s + l.paid, 0),
    balanceDue: running,
    orderCount: lines.filter((l) => l.kind === "MARGIN").length,
    paymentCount: lines.filter((l) => l.kind === "PAYMENT").length,
  };
  return { lines: lines.reverse(), totals };
}
