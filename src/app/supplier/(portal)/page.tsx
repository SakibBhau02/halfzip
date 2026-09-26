import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBDT, formatDate } from "@/lib/utils";
import { getSupplierBalance } from "@/lib/supplier";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "New Forward",
  ACCEPTED: "Accepted",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};
const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-blue-50 text-blue-600 ring-blue-200",
  ACCEPTED: "bg-indigo-50 text-indigo-600 ring-indigo-200",
  PACKED: "bg-amber-50 text-amber-700 ring-amber-200",
  SHIPPED: "bg-purple-50 text-purple-600 ring-purple-200",
  DELIVERED: "bg-emerald-50 text-emerald-600 ring-emerald-200",
  RETURNED: "bg-orange-50 text-orange-600 ring-orange-200",
  CANCELLED: "bg-rose-50 text-rose-600 ring-rose-200",
};

export default async function SupplierDashboard() {
  const session = await auth();
  const supplierId = (session?.user as { supplierId?: string }).supplierId!;

  const [pending, inProgress, delivered, recent, balance] = await Promise.all([
    prisma.supplierOrder.count({ where: { supplierId, status: "PENDING" } }),
    prisma.supplierOrder.count({
      where: { supplierId, status: { in: ["ACCEPTED", "PACKED", "SHIPPED"] } },
    }),
    prisma.supplierOrder.count({ where: { supplierId, status: "DELIVERED" } }),
    prisma.supplierOrder.findMany({
      where: { supplierId },
      orderBy: { forwardedAt: "desc" },
      take: 6,
      include: { order: { include: { items: true } } },
    }),
    getSupplierBalance(supplierId),
  ]);

  const stats = [
    { label: "New Forwards", value: pending, tone: "text-blue-600" },
    { label: "In Progress", value: inProgress, tone: "text-amber-600" },
    { label: "Delivered", value: delivered, tone: "text-emerald-600" },
    { label: "Balance Due", value: formatBDT(balance.balance), tone: "text-slate-900" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">
          আপনার কাছে forward করা orders — {formatDate(new Date())}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
              {s.label}
            </p>
            <p className={`font-display text-2xl mt-2 ${s.tone}`}>{s.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-slate-900 font-semibold">Recent Forwards</h2>
          <Link href="/supplier/orders" className="text-xs font-medium text-amber-700 hover:underline">
            View all →
          </Link>
        </div>
        <div className="divide-y divide-slate-100">
          {recent.length === 0 && (
            <p className="px-5 py-10 text-center text-sm text-slate-500">
              এখনো কোনো order forward হয়নি।
            </p>
          )}
          {recent.map((so) => (
            <Link
              key={so.id}
              href={`/supplier/orders/${so.orderId}`}
              className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-900 font-medium font-mono">
                  {so.order.orderNumber}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {so.order.shipName} · {so.order.items.length} item(s) ·{" "}
                  {formatDate(so.forwardedAt)}
                </p>
              </div>
              <span className="font-display text-slate-900 shrink-0">
                {formatBDT(so.supplierCost)}
              </span>
              <span
                className={`text-[11px] font-medium px-2 py-1 rounded-full ring-1 shrink-0 ${
                  STATUS_STYLE[so.status]
                }`}
              >
                {STATUS_LABEL[so.status]}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
