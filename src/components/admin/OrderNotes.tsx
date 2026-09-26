"use client";

import { useState, useTransition } from "react";
import { updateOrderNotes } from "@/app/admin/(dashboard)/orders/actions";

export default function OrderNotes({
  orderId,
  initial,
}: {
  orderId: string;
  initial: string;
}) {
  const [notes, setNotes] = useState(initial);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const save = () =>
    start(async () => {
      await updateOrderNotes(orderId, notes);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="text-slate-900 font-medium mb-3">Internal Notes</h2>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="অর্ডার সম্পর্কে নোট (customer দেখবে না)…"
        className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-gold resize-none"
      />
      <button
        onClick={save}
        disabled={pending}
        className="mt-3 bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm px-4 py-2 rounded-lg transition disabled:opacity-50"
      >
        {saved ? "Saved ✓" : pending ? "Saving…" : "Save note"}
      </button>
    </div>
  );
}
