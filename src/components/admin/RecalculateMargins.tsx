"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recalculateMargins } from "@/app/admin/(dashboard)/suppliers/actions";

/** One-click margin audit: recompute every EARNING entry from its order. */
export default function RecalculateMargins() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  const run = () =>
    start(async () => {
      if (!confirm("সব margin entry নতুন formula-এ (বিক্রি − কেনা + ডেলিভারি) মিলিয়ে দেখবো?")) return;
      const res = await recalculateMargins();
      setMsg(
        res.ok
          ? `✓ ${res.checked} checked, ${res.fixed} fixed`
          : (res.error ?? "Failed")
      );
      if (res.ok) router.refresh();
      setTimeout(() => setMsg(""), 4000);
    });

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={run}
        disabled={pending}
        className="bg-white border border-slate-200 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:border-amber-400 transition disabled:opacity-50"
      >
        {pending ? "Checking…" : "🧮 Recalculate Margins"}
      </button>
      {msg && <span className="text-sm text-slate-600">{msg}</span>}
    </div>
  );
}
