"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordCodCollected, recordAdvancePaid } from "@/app/admin/(dashboard)/orders/actions";

export default function PaymentTracker({
  orderId,
  total,
  advancePaid,
  codCollected,
  paymentStatus,
}: {
  orderId: string;
  total: number;
  advancePaid: number;
  codCollected: number;
  paymentStatus: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [adv, setAdv] = useState((advancePaid / 100).toString());
  const [col, setCol] = useState((codCollected / 100).toString());
  const [msg, setMsg] = useState("");

  const collectible = total - advancePaid;
  const shortfall = codCollected > 0 ? codCollected - collectible : 0;

  const saveAdv = () =>
    start(async () => {
      const res = await recordAdvancePaid(orderId, Math.round(Number(adv) * 100));
      setMsg(res.ok ? "Saved ✓" : res.error ?? "Failed");
      setTimeout(() => setMsg(""), 2000);
      router.refresh();
    });

  const saveCol = () =>
    start(async () => {
      const res = await recordCodCollected(orderId, Math.round(Number(col) * 100));
      setMsg(res.ok ? "Saved ✓" : res.error ?? "Failed");
      setTimeout(() => setMsg(""), 2000);
      router.refresh();
    });

  const bdt = (n: number) => `৳${(n / 100).toLocaleString("en-BD")}`;
  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="text-slate-900 font-semibold mb-3">Payment / COD</h2>

      <div className="grid grid-cols-2 gap-2 text-sm mb-4">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500">Order Total</p>
          <p className="font-semibold text-slate-900">{bdt(total)}</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3">
          <p className="text-xs text-amber-700">COD Collectible</p>
          <p className="font-semibold text-amber-800">{bdt(collectible)}</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs text-slate-500 mb-1">
            Advance Paid (৳)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={adv}
              onChange={(e) => setAdv(e.target.value)}
              className={inputCls}
              placeholder="0"
            />
            <button
              onClick={saveAdv}
              disabled={pending}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 rounded-lg transition disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">
            COD Collected (৳)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={col}
              onChange={(e) => setCol(e.target.value)}
              className={inputCls}
              placeholder="0"
            />
            <button
              onClick={saveCol}
              disabled={pending}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-4 rounded-lg transition disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>

      {shortfall !== 0 && (
        <p
          className={`text-xs mt-3 rounded-lg px-3 py-2 ${
            shortfall > 0
              ? "bg-rose-50 text-rose-600"
              : "bg-emerald-50 text-emerald-600"
          }`}
        >
          {shortfall > 0
            ? `⚠️ Shortfall: ${bdt(shortfall / 100)} কম Collected`
            : `✓ Collected সম্পূর্ণ`}
        </p>
      )}

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
        <span className="text-slate-500">Status</span>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-full ${
            paymentStatus === "PAID"
              ? "bg-emerald-50 text-emerald-600"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {paymentStatus}
        </span>
      </div>
      {msg && <p className="text-xs text-emerald-600 mt-2">{msg}</p>}
    </div>
  );
}
