import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatBDT, formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/order-status";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const customer = await prisma.customer.findUnique({
    where: { id: params.id },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: { items: true },
      },
    },
  });
  if (!customer) notFound();

  const delivered = customer.orders.filter((o) => o.status === "DELIVERED");
  const returned = customer.orders.filter((o) => o.status === "RETURNED");
  const spent = delivered.reduce((s, o) => s + o.total, 0);
  const aov = delivered.length ? Math.round(spent / delivered.length) : 0;

  const stats = [
    { label: "Total Orders", value: String(customer.orders.length) },
    { label: "Delivered", value: String(delivered.length) },
    { label: "Returned", value: String(returned.length) },
    { label: "Total Spent", value: formatBDT(spent) },
    { label: "Avg Order", value: formatBDT(aov) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/customers"
          className="text-xs text-slate-600 hover:text-gold"
        >
          ← Back to customers
        </Link>
        <h1 className="font-display text-3xl text-slate-900 mt-1">
          {customer.name ?? "Unnamed Customer"}
        </h1>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600 mt-2">
          <a href={`tel:${customer.phone}`} className="hover:text-gold">
            📞 {customer.phone}
          </a>
          {customer.email && <span>✉️ {customer.email}</span>}
          <span>Since {formatDate(customer.createdAt)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="bg-white border border-slate-200 rounded-2xl p-4"
          >
            <p className="text-xs uppercase tracking-wider text-slate-600">
              {s.label}
            </p>
            <p className="font-display text-2xl text-slate-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h2 className="text-slate-900 font-medium mb-3">Profile</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-slate-600 text-xs">Address</dt>
              <dd className="text-slate-700 whitespace-pre-wrap">
                {customer.address ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-slate-600 text-xs">District</dt>
              <dd className="text-slate-700">{customer.district ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-600 text-xs">Notes</dt>
              <dd className="text-slate-700">{customer.notes ?? "—"}</dd>
            </div>
          </dl>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-slate-900 font-medium">Order History</h2>
          </div>
          <div className="divide-y divide-slate-200">
            {customer.orders.length === 0 && (
              <p className="px-5 py-8 text-sm text-slate-600 text-center">
                কোনো order নেই।
              </p>
            )}
            {customer.orders.map((o) => (
              <Link
                key={o.id}
                href={`/admin/orders/${o.id}`}
                className="px-5 py-3.5 flex items-center gap-3 hover:bg-slate-100 transition"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-900">{o.orderNumber}</p>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {formatDate(o.createdAt)} ·{" "}
                    {o.items.reduce((s, i) => s + i.quantity, 0)} item(s)
                  </p>
                </div>
                <span className="font-display text-slate-900 shrink-0">
                  {formatBDT(o.total)}
                </span>
                <span
                  className={`text-[11px] px-2 py-1 rounded-full ring-1 shrink-0 ${
                    STATUS_STYLES[o.status]
                  }`}
                >
                  {STATUS_LABELS[o.status]}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
