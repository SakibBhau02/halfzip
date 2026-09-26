"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatBDT } from "@/lib/utils";
import { requestWithdrawal } from "@/app/admin/(dashboard)/suppliers/actions";

export default function RequestWithdrawal({
  suppliers,
}: {
  suppliers: { id: string; name: string; balance: number }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? "");
  const [method, setMethod] = useState("BKASH");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState("");

  const selected = suppliers.find((s) => s.id === supplierId);
  const [amount, setAmount] = useState(
    selected ? (selected.balance / 100).toString() : ""
  );

  const onPickSupplier = (id: string) => {
    setSupplierId(id);
    const s = suppliers.find((x) => x.id === id);
    setAmount(s ? (s.balance / 100).toString() : "");
  };

  const submit = () =>
    start(async () => {
      setMsg("");
      const res = await requestWithdrawal(
        supplierId,
        Math.round(Number(amount) * 100),
        method,
        note
      );
      if (!res.ok) setMsg(res.error ?? "Failed");
      else {
        setOpen(false);
        router.refresh();
      }
    });

  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        disabled={suppliers.length === 0}
        className="bg-slate-900 text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-40"
      >
        + Request Withdrawal
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-sm bg-white rounded-2xl p-6 shadow-2xl">
            <h3 className="text-slate-900 font-semibold text-lg mb-4">
              Request Margin Withdrawal
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Supplier</label>
                <select
                  value={supplierId}
                  onChange={(e) => onPickSupplier(e.target.value)}
                  className={inputCls}
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} — {formatBDT(s.balance)} due
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  Amount (৳)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Method</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className={inputCls}
                >
                  {["BKASH", "NAGAD", "BANK"].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Note</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={inputCls}
                  placeholder="optional"
                />
              </div>
              {msg && <p className="text-xs text-rose-600">{msg}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={submit}
                  disabled={pending}
                  className="flex-1 bg-gold text-ink font-semibold py-2.5 rounded-lg hover:brightness-110 transition disabled:opacity-50"
                >
                  {pending ? "Sending…" : "Send Request"}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2.5 rounded-lg text-slate-500 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
