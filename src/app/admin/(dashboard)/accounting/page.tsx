import { prisma } from "@/lib/prisma";
import { formatBDT, formatDate } from "@/lib/utils";
import { getSupplierBalance, getMarginSummary } from "@/lib/supplier";
import WithdrawalActions from "@/components/admin/WithdrawalActions";
import RequestWithdrawal from "@/components/admin/RequestWithdrawal";

export const dynamic = "force-dynamic";

export default async function AccountingPage() {
  const [suppliers, payouts, margin] = await Promise.all([
    prisma.supplier.findMany(),
    prisma.supplierPayout.findMany({
      orderBy: { createdAt: "desc" },
      include: { supplier: true },
      take: 100,
    }),
    getMarginSummary(),
  ]);

  const balances = await Promise.all(
    suppliers.map(async (s) => ({ supplier: s, ...(await getSupplierBalance(s.id)) }))
  );

  const totalReceivable = balances.reduce((sum, b) => sum + b.balance, 0);
  const pending = payouts.filter(
    (p) => p.status === "REQUESTED" || p.status === "APPROVED"
  );

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

      {/* withdrawal requests */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
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
