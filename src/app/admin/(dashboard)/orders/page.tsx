import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ALL_STATUSES, STATUS_LABELS } from "@/lib/order-status";
import OrdersToolbar from "@/components/admin/OrdersToolbar";
import OrdersTable from "@/components/admin/OrdersTable";

export const dynamic = "force-dynamic";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

const DATE_RANGES: Record<string, () => Date | undefined> = {
  today: () => startOfDay(new Date()),
  "7d": () => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d;
  },
  "30d": () => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d;
  },
  all: () => undefined,
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { status?: string; range?: string; q?: string };
}) {
  const status = searchParams.status;
  const range = searchParams.range ?? "30d";
  const q = searchParams.q?.trim();

  const where: Prisma.OrderWhereInput = {};
  if (status && ALL_STATUSES.includes(status as never)) {
    where.status = status as never;
  }
  const since = DATE_RANGES[range]?.();
  if (since) where.createdAt = { gte: since };
  if (q) {
    where.OR = [
      { orderNumber: { contains: q, mode: "insensitive" } },
      { shipName: { contains: q, mode: "insensitive" } },
      { shipPhone: { contains: q } },
    ];
  }

  const [orders, counts] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { customer: true, items: true, supplierOrder: { include: { supplier: true } } },
      take: 200,
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const countMap = Object.fromEntries(
    counts.map((c) => [c.status, c._count._all])
  ) as Record<string, number>;
  const totalAll = counts.reduce((s, c) => s + c._count._all, 0);

  const buildHref = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { status, range, q, ...patch };
    Object.entries(merged).forEach(([k, v]) => {
      if (v) sp.set(k, v);
    });
    return `/admin/orders?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-slate-900">Orders</h1>
          <p className="text-sm text-slate-600 mt-1">
            {orders.length} shown · {totalAll} total
          </p>
        </div>
        <Link
          href="/admin/orders/new"
          className="bg-gold text-ink text-sm font-semibold px-5 py-2.5 rounded-lg hover:brightness-110 transition"
        >
          + New Order
        </Link>
      </div>

      {/* status tabs */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={buildHref({ status: undefined })}
          className={`text-sm px-3.5 py-2 rounded-lg border transition ${
            !status
              ? "bg-gold/15 text-gold border-gold/30"
              : "border-slate-200 text-slate-600 hover:text-slate-900"
          }`}
        >
          All · {totalAll}
        </Link>
        {ALL_STATUSES.map((s) => (
          <Link
            key={s}
            href={buildHref({ status: s })}
            className={`text-sm px-3.5 py-2 rounded-lg border transition ${
              status === s
                ? "bg-gold/15 text-gold border-gold/30"
                : "border-slate-200 text-slate-600 hover:text-slate-900"
            }`}
          >
            {STATUS_LABELS[s]} · {countMap[s] ?? 0}
          </Link>
        ))}
      </div>

      <OrdersToolbar range={range} q={q ?? ""} />

      <OrdersTable
        orders={orders.map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          status: o.status,
          paymentMethod: o.paymentMethod,
          paymentStatus: o.paymentStatus,
          total: o.total,
          shipName: o.shipName,
          shipPhone: o.shipPhone,
          shipDistrict: o.shipDistrict,
          itemCount: o.items.reduce((s, i) => s + i.quantity, 0),
          createdAt: o.createdAt.toISOString(),
          forwardedTo: o.supplierOrder?.supplier?.name ?? null,
        }))}
      />
    </div>
  );
}
