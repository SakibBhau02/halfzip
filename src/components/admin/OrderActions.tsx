"use client";

import { useState, useTransition } from "react";
import type { OrderStatus } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/order-status";
import { updateOrderStatus } from "@/app/admin/(dashboard)/orders/actions";

const ACTION_STYLE: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "bg-indigo-500 hover:bg-indigo-400 text-slate-900",
  PROCESSING: "bg-amber-500 hover:bg-amber-400 text-ink",
  SHIPPED: "bg-purple-500 hover:bg-purple-400 text-slate-900",
  DELIVERED: "bg-emerald-500 hover:bg-emerald-400 text-slate-900",
  RETURNED: "bg-orange-500 hover:bg-orange-400 text-slate-900",
  CANCELLED: "bg-rose-600 hover:bg-rose-500 text-slate-900",
};

export default function OrderActions({
  orderId,
  nextStatuses,
}: {
  orderId: string;
  nextStatuses: OrderStatus[];
}) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const act = (to: OrderStatus) =>
    start(async () => {
      setError("");
      const res = await updateOrderStatus(orderId, to, note);
      if (!res.ok) setError(res.error ?? "Failed");
      else setNote("");
    });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="text-slate-900 font-medium mb-3">Update Status</h2>

      {nextStatuses.length === 0 ? (
        <p className="text-sm text-slate-600">
          এই status terminal — আর পরিবর্তন করা যাবে না।
        </p>
      ) : (
        <>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-gold mb-3"
          />
          <div className="space-y-2">
            {nextStatuses.map((s) => (
              <button
                key={s}
                disabled={pending}
                onClick={() => act(s)}
                className={`w-full text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-50 ${
                  ACTION_STYLE[s] ?? "bg-slate-100 text-slate-900 hover:bg-slate-200"
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          {error && (
            <p className="text-xs text-rose-500 mt-3 bg-rose-50 rounded px-3 py-2">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}
