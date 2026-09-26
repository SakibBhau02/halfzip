import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBDT, formatDate } from "@/lib/utils";
import { getSupplierBalance } from "@/lib/supplier";
import WithdrawalConfirm from "@/components/supplier/WithdrawalConfirm";

export const dynamic = "force-dynamic";

export default async function EarningsPage() {
  const session = await auth();
  const supplierId = (session?.user as { supplierId?: string }).supplierId!;

  const [balance, ledger, payouts] = await Promise.all([
    getSupplierBalance(supplierId),
    prisma.supplierLedger.findMany({
      where: { supplierId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { },
    }),
    prisma.supplierPayout.findMany({
      where: { supplierId },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const pending = payouts.filter((p) => p.status === "REQUESTED");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-slate-900">Earnings</h1>
        <p className="text-sm text-slate-500 mt-1">
          আপনার কাছে reseller-এর পাওনা (margin) হিসাব
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Total Margin Owed
          </p>
          <p className="font-display text-2xl text-slate-900 mt-2">
            {formatBDT(balance.earned)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Already Sent
          </p>
          <p className="font-display text-2xl text-slate-900 mt-2">
            {formatBDT(balance.withdrawn)}
          </p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-xs uppercase tracking-wider text-amber-700">
            You Still Owe Reseller
          </p>
          <p className="font-display text-2xl text-amber-800 mt-2">
            {formatBDT(balance.balance)}
          </p>
        </div>
      </div>

      {/* pending withdrawal requests from admin */}
      {pending.length > 0 && (
        <div className="bg-white border border-amber-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50">
            <h2 className="text-amber-800 font-semibold">
              Withdrawal Requests ({pending.length})
            </h2>
            <p className="text-xs text-amber-600 mt-0.5">
              Reseller আপনার কাছে এই margin চাচ্ছে — transfer করে confirm করুন।
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

      {/* ledger */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-slate-900 font-semibold">Transaction History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {["Date", "Type", "Amount", "Note"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-slate-500">
                    কোনো transaction নেই।
                  </td>
                </tr>
              )}
              {ledger.map((l) => (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatDate(l.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] font-medium px-2 py-1 rounded-full ${
                        l.type === "EARNING"
                          ? "bg-amber-50 text-amber-700"
                          : l.type === "WITHDRAWAL"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {l.type === "EARNING" ? "Margin Due" : l.type === "WITHDRAWAL" ? "Sent" : "Adjustment"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {l.type === "WITHDRAWAL" ? "- " : "+ "}
                    {formatBDT(l.amount)}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{l.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
