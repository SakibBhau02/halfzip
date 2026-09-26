import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBDT, formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/order-status";

export const dynamic = "force-dynamic";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function daysAgo(n: number) {
  const x = new Date();
  x.setDate(x.getDate() - n);
  return x;
}

function Icon({ name, className = "w-5 h-5" }: { name: string; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "bag":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M6 7h12l1 13H5L6 7z" />
          <path d="M9 7a3 3 0 016 0" />
        </svg>
      );
    case "alert":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M12 9v4m0 4h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
        </svg>
      );
    case "truck":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7" />
          <circle cx="5.5" cy="18.5" r="1.5" />
          <circle cx="18.5" cy="18.5" r="1.5" />
        </svg>
      );
    case "return":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M3 7v6h6" />
          <path d="M3.5 13a9 9 0 103-7.7L3 8" />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20M16 15h2" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={className} {...common}>
          <path d="M12 2v20M2 12h20" />
        </svg>
      );
  }
}

function Stat({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: string;
  tone: "blue" | "amber" | "purple" | "rose" | "emerald" | "gold";
}) {
  const tones: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    purple: "bg-purple-50 text-purple-600",
    rose: "bg-rose-50 text-rose-600",
    emerald: "bg-emerald-50 text-emerald-600",
    gold: "bg-amber-50 text-amber-700",
  };
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-sm transition">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <p className="font-display text-3xl text-slate-900 mt-2">{value}</p>
          {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
        </div>
        <span className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>
          <Icon name={icon} />
        </span>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  const today = startOfDay();
  const d30 = daysAgo(30);

  const [
    todayOrders,
    pendingConfirm,
    inTransit,
    delivered30,
    returned30,
    cancelled30,
    total30,
    receivables,
    revenueAgg,
    recent,
    lowStock,
  ] = await Promise.all([
    prisma.order.count({
      where: { createdAt: { gte: today }, status: { not: "CANCELLED" } },
    }),
    prisma.order.count({ where: { status: "NEW" } }),
    prisma.order.count({ where: { status: { in: ["PROCESSING", "SHIPPED"] } } }),
    prisma.order.count({ where: { status: "DELIVERED", createdAt: { gte: d30 } } }),
    prisma.order.count({ where: { status: "RETURNED", createdAt: { gte: d30 } } }),
    prisma.order.count({ where: { status: "CANCELLED", createdAt: { gte: d30 } } }),
    prisma.order.count({ where: { createdAt: { gte: d30 } } }),
    prisma.order.aggregate({
      _sum: { total: true },
      where: { status: "DELIVERED", paymentStatus: "UNPAID" },
    }),
    prisma.order.aggregate({
      _sum: { total: true },
      _avg: { total: true },
      where: { status: "DELIVERED", createdAt: { gte: d30 } },
    }),
    prisma.order.findMany({
      take: 8,
      orderBy: { createdAt: "desc" },
      include: { customer: true, items: true },
    }),
    prisma.productVariant.findMany({
      where: { stock: { lte: 3 }, active: true },
      orderBy: { stock: "asc" },
      take: 6,
    }),
  ]);

  const returnRate =
    delivered30 + returned30 > 0
      ? Math.round((returned30 / (delivered30 + returned30)) * 100)
      : 0;

  return (
    <div className="space-y-8">
      {/* header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-600 mt-1">
            আজকের snapshot — {formatDate(new Date())}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/admin/orders?status=NEW"
            className="bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:border-slate-400 transition"
          >
            {pendingConfirm} pending
          </Link>
          <Link
            href="/admin/orders/new"
            className="bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-slate-800 transition"
          >
            + New Order
          </Link>
        </div>
      </div>

      {/* primary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Today's Orders"
          value={String(todayOrders)}
          sub="excluding cancelled"
          icon="bag"
          tone="blue"
        />
        <Stat
          label="Pending Confirmation"
          value={String(pendingConfirm)}
          sub="action required"
          icon="alert"
          tone="amber"
        />
        <Stat
          label="In Transit"
          value={String(inTransit)}
          sub="processing + shipped"
          icon="truck"
          tone="purple"
        />
        <Stat
          label="Return Rate"
          value={`${returnRate}%`}
          sub="last 30 days"
          icon="return"
          tone={returnRate > 15 ? "rose" : "emerald"}
        />
      </div>

      {/* financial KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Revenue (30d)"
          value={formatBDT(revenueAgg._sum.total ?? 0)}
          sub={`${delivered30} delivered`}
          icon="wallet"
          tone="emerald"
        />
        <Stat
          label="Avg Order Value"
          value={formatBDT(Math.round(revenueAgg._avg.total ?? 0))}
          sub="last 30 days"
          icon="bag"
          tone="gold"
        />
        <Stat
          label="COD Receivables"
          value={formatBDT(receivables._sum.total ?? 0)}
          sub="delivered, unpaid"
          icon="wallet"
          tone="amber"
        />
        <Stat
          label="Total Orders (30d)"
          value={String(total30)}
          sub={`${cancelled30} cancelled`}
          icon="bag"
          tone="blue"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* recent orders */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-slate-900 font-semibold">Recent Orders</h2>
            <Link href="/admin/orders" className="text-xs font-medium text-amber-700 hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {recent.length === 0 && (
              <p className="px-5 py-10 text-sm text-slate-500 text-center">
                এখনো কোনো order নেই।
              </p>
            )}
            {recent.map((o) => (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-900 truncate font-medium">
                    {o.shipName}
                    <span className="text-slate-500 font-normal"> · {o.shipPhone}</span>
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {o.orderNumber} · {formatDate(o.createdAt)} · {o.items.length} item(s)
                  </p>
                </div>
                <span className="font-display text-slate-900 shrink-0">
                  {formatBDT(o.total)}
                </span>
                <span
                  className={`text-[11px] font-medium px-2 py-1 rounded-full ring-1 shrink-0 ${
                    STATUS_STYLES[o.status]
                  }`}
                >
                  {STATUS_LABELS[o.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* low stock */}
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-slate-900 font-semibold">Low Stock Alerts</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {lowStock.length === 0 && (
              <p className="px-5 py-10 text-sm text-slate-500 text-center">
                সব variant-এ পর্যাপ্ত stock আছে।
              </p>
            )}
            {lowStock.map((v) => (
              <div key={v.id} className="px-5 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-900 font-medium">
                    {v.color} · {v.size}
                  </p>
                  <p className="text-xs text-slate-500 font-mono">{v.sku}</p>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    v.stock === 0 ? "text-rose-600" : "text-amber-600"
                  }`}
                >
                  {v.stock} left
                </span>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
            <Link href="/admin/products" className="text-xs font-medium text-amber-700 hover:underline">
              Manage inventory →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
