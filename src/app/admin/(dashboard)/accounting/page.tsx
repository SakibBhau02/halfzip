import { prisma } from "@/lib/prisma";
import { formatBDT, formatDate } from "@/lib/utils";
import { getSupplierBalance, getMarginSummary, getSupplierStatement } from "@/lib/supplier";
import WithdrawalActions from "@/components/admin/WithdrawalActions";
import RequestWithdrawal from "@/components/admin/RequestWithdrawal";
import RecalculateMargins from "@/components/admin/RecalculateMargins";

export const dynamic = "force-dynamic";

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: { supplier?: string };
}) {
  const [suppliers, payouts, margin, earnings] = await Promise.all([
    prisma.supplier.findMany(),
    prisma.supplierPayout.findMany({
      orderBy: { createdAt: "desc" },
      include: { supplier: true },
      take: 100,
    }),
    getMarginSummary(),
    prisma.supplierLedger.findMany({
      where: { type: "EARNING" },
      orderBy: { createdAt: "desc" },
      include: {
        supplier: true,
      },
      take: 30,
    }),
  ]);

  // attach order numbers for the earning rows
  const earningOrderIds = earnings
    .map((e) => e.orderId)
    .filter((id): id is string => !!id);
  const earningOrders = await prisma.order.findMany({
    where: { id: { in: earningOrderIds } },
    select: { id: true, orderNumber: true, subtotal: true, supplierCost: true, deliveryFee: true },
  });
  const orderById = Object.fromEntries(earningOrders.map((o) => [o.id, o]));

  const balances = await Promise.all(
    suppliers.map(async (s) => ({ supplier: s, ...(await getSupplierBalance(s.id)) }))
  );

  const totalReceivable = balances.reduce((sum, b) => sum + b.balance, 0);
  const pending = payouts.filter(
    (p) => p.status === "REQUESTED" || p.status === "APPROVED"
  );

  // Selected supplier statement (mirror of what the supplier sees)
  const selectedId = searchParams.supplier ?? suppliers[0]?.id ?? null;
  const selected = suppliers.find((s) => s.id === selectedId) ?? suppliers[0] ?? null;
  const statement = selected ? await getSupplierStatement(selected.id) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-slate-900">Accounting</h1>
          <p className="text-sm text-slate-500 mt-1">
            আপনার margin, supplier পাওনা ও withdrawal
          </p>
        </div>
        <RequestWithdrawal
          suppliers={balances
            .filter((b) => b.balance > 0)
            .map((b) => ({
              id: b.supplier.id,
              name: b.supplier.name,
              balance: b.balance,
            }))}
        />
      </div>

      <RecalculateMargins />

      {/* margin KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Goods Margin
          </p>
          <p className="font-display text-2xl text-slate-900 mt-2">
            {formatBDT(margin.goodsMargin)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1">
            retail − supplier cost
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Delivery Margin
          </p>
          <p className="font-display text-2xl text-slate-900 mt-2">
            {formatBDT(margin.deliveryMargin)}
          </p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-emerald-700">
            Total Margin
          </p>
          <p className="font-display text-2xl text-emerald-700 mt-2">
            {formatBDT(margin.margin)}
          </p>
          <p className="text-[11px] text-emerald-600 mt-1">
            {margin.deliveredOrders} delivered orders
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-amber-700">
            Receivable
          </p>
          <p className="font-display text-2xl text-amber-800 mt-2">
            {formatBDT(totalReceivable)}
          </p>
          <p className="text-[11px] text-amber-600 mt-1">from suppliers</p>
        </div>
      </div>

      {/* margin ledger — কোন order থেকে কত লাভ */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-slate-900 font-semibold">
            Margin Ledger
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            প্রতিটা delivered order থেকে বিক্রি − কেনা = আপনার লাভ।
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {["Date", "Order", "Supplier", "বিক্রি", "কেনা", "ডেলিভারি", "লাভ"].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {earnings.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    এখনো কোনো delivered order নেই।
                  </td>
                </tr>
              )}
              {earnings.map((e) => {
                const o = e.orderId ? orderById[e.orderId] : undefined;
                return (
                  <tr key={e.id}>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(e.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-900">
                      {o?.orderNumber ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{e.supplier.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {o ? formatBDT(o.subtotal) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {o ? formatBDT(o.supplierCost) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {o ? formatBDT(o.deliveryFee) : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-emerald-600">
                      + {formatBDT(e.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* supplier balances */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-slate-900 font-semibold">
            Supplier Receivables
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Suppliers currently hold this much of your margin.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {["Supplier", "Delivered Margin", "Withdrawn", "Still Owed"].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {balances.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    কোনো supplier নেই।
                  </td>
                </tr>
              )}
              {balances.map((b) => (
                <tr key={b.supplier.id}>
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    {b.supplier.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatBDT(b.earned)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatBDT(b.withdrawn)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-amber-700">
                    {formatBDT(b.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* supplier statement — mirror of supplier's view */}
      {selected && statement && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-slate-900 font-semibold">
              Supplier Statement
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Supplier তার panel-এ হুবহু এই সংখ্যাগুলোই দেখে — কোনো গরমিল নেই।
            </p>
            {suppliers.length > 1 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {suppliers.map((s) => (
                  <a
                    key={s.id}
                    href={`/admin/accounting?supplier=${s.id}`}
                    className={`text-xs font-medium px-3 py-1.5 rounded-lg border transition ${
                      s.id === selected.id
                        ? "bg-slate-900 text-white border-slate-900"
                        : "border-slate-200 text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    {s.name}
                  </a>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-5 divide-x divide-slate-100 text-center">
            {[
              ["Collected (COD)", statement.totals.collected, "supplier তুলেছে"],
              ["Supplier Cost", statement.totals.cost, "সে রেখেছে"],
              ["My Margin", statement.totals.marginEarned, "আমার লাভ"],
              ["Received", statement.totals.paid, "আমি পেয়েছি"],
              ["Receivable", statement.totals.balanceDue, "এখনো পাবো"],
            ].map(([label, value, sub]) => (
              <div key={label as string} className="px-4 py-4">
                <p className="text-[11px] uppercase tracking-wider text-slate-500">
                  {label}
                </p>
                <p
                  className={`font-display text-xl mt-1 ${
                    label === "Receivable"
                      ? "text-amber-700"
                      : label === "My Margin"
                        ? "text-emerald-600"
                        : "text-slate-900"
                  }`}
                >
                  {formatBDT(value as number)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto border-t border-slate-100">
            <table className="w-full text-sm min-w-[860px]">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  {["Date", "Details", "Collected", "Cost", "Delivery", "My Margin", "Received", "Balance"].map(
                    (h) => (
                      <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {statement.lines.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">
                      এই supplier-এর এখনো কোনো লেনদেন নেই।
                    </td>
                  </tr>
                )}
                {statement.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(l.date)}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-slate-900 font-medium font-mono text-[13px]">
                        {l.kind === "MARGIN" ? l.ref : l.kind === "PAYMENT" ? "Payment received" : "Adjustment"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {l.kind === "MARGIN" ? "Delivered ✓" : l.note.length > 40 ? l.note.slice(0, 40) + "…" : l.note}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {l.collected ? formatBDT(l.collected) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {l.cost ? formatBDT(l.cost) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {l.delivery ? formatBDT(l.delivery) : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-emerald-600">
                      {l.margin ? `+${formatBDT(l.margin)}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {l.paid ? `−${formatBDT(l.paid)}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 whitespace-nowrap">
                      {formatBDT(l.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* withdrawal requests */}      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-slate-900 font-semibold">Withdrawal Requests</h2>
          {pending.length > 0 && (
            <span className="text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full">
              {pending.length} pending
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {["Supplier", "Amount", "Method", "Status", "Date", "Action"].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payouts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    কোনো withdrawal request নেই।
                  </td>
                </tr>
              )}
              {payouts.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-slate-900">{p.supplier.name}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {formatBDT(p.amount)}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.method}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                        p.status === "RECEIVED"
                          ? "bg-emerald-50 text-emerald-600"
                          : p.status === "REJECTED"
                            ? "bg-rose-50 text-rose-600"
                            : p.status === "APPROVED"
                              ? "bg-indigo-50 text-indigo-600"
                              : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatDate(p.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <WithdrawalActions payoutId={p.id} status={p.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
