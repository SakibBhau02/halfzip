"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markWithdrawalReceived,
  rejectWithdrawal,
} from "@/app/admin/(dashboard)/suppliers/actions";

export default function WithdrawalActions({
  payoutId,
  status,
}: {
  payoutId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showRecv, setShowRecv] = useState(false);
  const [ref, setRef] = useState("");

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
      setShowRecv(false);
    });

  if (status === "RECEIVED" || status === "REJECTED") {
    return <span className="text-xs text-slate-400">—</span>;
  }

  return (
    <div className="flex items-center gap-1.5">
      {!showRecv && (
        <button
          onClick={() => setShowRecv(true)}
          className="text-[11px] px-2.5 py-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
        >
          Mark Received
        </button>
      )}
      {showRecv && (
        <div className="flex items-center gap-1">
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value)}
            placeholder="TrxID"
            className="w-20 rounded border border-slate-200 px-2 py-1 text-xs outline-none"
          />
          <button
            onClick={() => run(() => markWithdrawalReceived(payoutId, ref))}
            disabled={pending}
            className="text-[11px] px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-40"
          >
            ✓
          </button>
        </div>
      )}
      <button
        onClick={() => run(() => rejectWithdrawal(payoutId, ""))}
        disabled={pending}
        className="text-[11px] px-2 py-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-40"
      >
        Reject
      </button>
    </div>
  );
}
