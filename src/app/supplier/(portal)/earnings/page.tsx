import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBDT, formatDate } from "@/lib/utils";
import { getSupplierStatement, getSupplierRateCard } from "@/lib/supplier";
import WithdrawalConfirm from "@/components/supplier/WithdrawalConfirm";

export const dynamic = "force-dynamic";

function FlowStep({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex-1 min-w-[140px] rounded-2xl p-5 border ${
        highlight
          ? "bg-amber-50 border-amber-300"
          : "bg-white border-slate-200"
      }`}
    >
      <p
        className={`text-xs uppercase tracking-wider ${
          highlight ? "text-amber-700" : "text-slate-500"
        }`}
      >
        {label}
      </p>
      <p
        className={`font-display text-xl mt-2 ${
          highlight ? "text-amber-800" : "text-slate-900"
        }`}
      >
        {value}
      </p>
      {sub && (
        <p
          className={`text-[11px] mt-1 ${
            highlight ? "text-amber-600" : "text-slate-400"
          }`}
        >
          {sub}
        </p>
      )}
    </div>
  );
}

export default async function EarningsPage() {
  const session = await auth();
  const supplierId = (session?.user as { supplierId?: string }).supplierId!;

  const [statement, payouts, rateCard] = await Promise.all([
    getSupplierStatement(supplierId),
    prisma.supplierPayout.findMany({
      where: { supplierId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    getSupplierRateCard(supplierId),
  ]);
  const t = statement.totals;

  const pending = payouts.filter((p) => p.status === "REQUESTED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-slate-900">
          Account Statement
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Customer টাকা দেয় → আপনি তোলেন → cost রেখে বাকি (লাভ) reseller-কে দেন।
          নিচে প্রতিটা লেনদেনের পূর্ণ হিসাব।
        </p>
      </div>

      {/* money flow */}
      <div className="flex flex-wrap items-stretch gap-3">
        <FlowStep
          label="① COD Collected"
          value={formatBDT(t.collected)}
          sub={`customer দিয়েছে · ${t.orderCount} orders`}
        />
        <FlowStep
          label="② Your Cost Kept"
          value={formatBDT(t.cost)}
          sub="product-এর দাম আপনি রাখেন"
        />
        <FlowStep
          label="③ Delivery"
          value={formatBDT(t.delivery)}
          sub="courier খরচ আপনার"
        />
        <FlowStep
          label="④ Reseller Margin"
          value={formatBDT(t.marginEarned)}
          sub="collected − your cost"
        />
        <FlowStep
          label="⑤ You Paid"
          value={formatBDT(t.paid)}
          sub={`${t.paymentCount} payments`}
        />
        <FlowStep
          label="Balance You Owe"
          value={formatBDT(t.balanceDue)}
          sub="এখনো reseller-কে দিতে হবে"
          highlight
        />
      </div>

      {/* pending withdrawal requests from admin */}
      {pending.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50">
            <h2 className="text-amber-800 font-semibold">
              Payment Requests ({pending.length})
            </h2>
            <p className="text-xs text-amber-600 mt-0.5">
              Reseller এই টাকা চাচ্ছে — transfer করে confirm করুন।
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {pending.map((p) => (
              <div key={p.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-slate-900 font-semibold">
                    {formatBDT(p.amount)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.method} · {formatDate(p.createdAt)}
                  </p>
                </div>
                <WithdrawalConfirm payoutId={p.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* full statement with running balance */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-slate-900 font-semibold">Full Statement</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            প্রতিটা order-এ কত তুললেন, কত রাখলেন, কত দিলেন — running balance সহ।
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {["Date", "Details", "Collected", "Your Cost", "Delivery", "Margin", "Paid", "Balance"].map(
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
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    এখনো কোনো লেনদেন নেই। Order deliver হলে এখানে হিসাব আসবে।
                  </td>
                </tr>
              )}
              {statement.lines.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatDate(l.date)}
                  </td>
                  <td className="px-4 py-3">
                    {l.kind === "MARGIN" ? (
                      <div>
                        <p className="text-slate-900 font-medium font-mono text-[13px]">
                          {l.ref}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Delivered ✓ margin due
                        </p>
                      </div>
                    ) : l.kind === "PAYMENT" ? (
                      <div>
                        <p className="text-slate-900 font-medium text-[13px]">
                          Payment sent
                        </p>
                        <p className="text-[11px] text-slate-400">
                          {l.ref.length > 40 ? l.ref.slice(0, 40) + "…" : l.ref}
                        </p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-slate-900 font-medium text-[13px]">
                          Adjustment
                        </p>
                        <p className="text-[11px] text-slate-400">{l.note}</p>
                      </div>
                    )}
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
                  <td className="px-4 py-3 font-medium text-amber-700">
                    {l.margin ? `+${formatBDT(l.margin)}` : "—"}
                  </td>
                  <td className="px-4 py-3 font-medium text-emerald-600">
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

      {/* rate card — deal transparency */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-slate-900 font-semibold">My Rate Card</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            প্রতি পিসে customer price vs আপনার cost — বাকিটা reseller-এর লাভ।
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {["Product", "Customer Price", "Your Cost", "Reseller লাভ/pc"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rateCard.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    কোনো product নেই।
                  </td>
                </tr>
              )}
              {rateCard.map((r) => (
                <tr key={r.productId}>
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    {r.productName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{formatBDT(r.retail)}</td>
                  <td className="px-4 py-3 text-slate-900 font-medium">
                    {formatBDT(r.cost)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-600">
                    +{formatBDT(r.perPcMargin)}
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
