"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export default function OrdersToolbar({
  range,
  q,
}: {
  range: string;
  q: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [term, setTerm] = useState(q);

  const push = (patch: Record<string, string | undefined>) => {
    const sp = new URLSearchParams(searchParams.toString());
    Object.entries(patch).forEach(([k, v]) => {
      if (v) sp.set(k, v);
      else sp.delete(k);
    });
    start(() => router.push(`/admin/orders?${sp.toString()}`));
  };

  const ranges = [
    { k: "today", l: "Today" },
    { k: "7d", l: "7 days" },
    { k: "30d", l: "30 days" },
    { k: "all", l: "All time" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
        {ranges.map((r) => (
          <button
            key={r.k}
            onClick={() => push({ range: r.k })}
            className={`text-xs px-3 py-1.5 rounded-md transition ${
              range === r.k
                ? "bg-gold text-ink font-medium"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {r.l}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          push({ q: term || undefined });
        }}
        className="flex-1 min-w-[220px] flex gap-2"
      >
        <input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search order#, name, phone…"
          className="flex-1 rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-gold"
        />
        <button
          type="submit"
          disabled={pending}
          className="bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm px-4 rounded-lg transition disabled:opacity-50"
        >
          Search
        </button>
      </form>
    </div>
  );
}
