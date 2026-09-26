"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markWithdrawalSent } from "@/app/supplier/actions";

export default function WithdrawalConfirm({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [ref, setRef] = useState("");
  const [msg, setMsg] = useState("");

  const submit = () =>
    start(async () => {
      setMsg("");
      const res = await markWithdrawalSent(payoutId, ref);
      if (!res.ok) setMsg(res.error ?? "Failed");
      else {
        setOpen(false);
        router.refresh();
      }
    });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-emerald-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-emerald-500 transition"
      >
        Mark as Sent
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        value={ref}
        onChange={(e) => setRef(e.target.value)}
        placeholder="TrxID / ref"
        className="w-28 rounded-lg border border-slate-200 px-2.5 py-2 text-xs outline-none focus:border-amber-400"
      />
      <button
        onClick={submit}
        disabled={pending}
        className="bg-emerald-600 text-white text-xs font-medium px-3 py-2 rounded-lg disabled:opacity-50"
      >
        {pending ? "…" : "Confirm"}
      </button>
      {msg && <span className="text-xs text-rose-600">{msg}</span>}
    </div>
  );
}
