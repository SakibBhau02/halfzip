"use client";

import { useEffect, useState, useTransition } from "react";
import { forwardOrderToSupplier } from "@/app/admin/(dashboard)/suppliers/actions";

type Sup = { id: string; name: string; active: boolean; cost: number };

export default function ForwardModal({
  orderId,
  onClose,
  onDone,
}: {
  orderId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [suppliers, setSuppliers] = useState<Sup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/suppliers", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setSuppliers(d.suppliers ?? []);
        const firstActive = (d.suppliers ?? []).find((s: Sup) => s.active);
        if (firstActive) setSelected(firstActive.id);
      })
      .finally(() => setLoading(false));
  }, []);

  const submit = () =>
    start(async () => {
      setError("");
      if (!selected) {
        setError("Supplier নির্বাচন করুন।");
        return;
      }
      const res = await forwardOrderToSupplier(orderId, selected);
      if (!res.ok) setError(res.error ?? "Failed");
      else onDone();
    });

  const active = suppliers.filter((s) => s.active);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl">
        <h3 className="text-slate-900 font-semibold text-lg mb-1">
          Forward to Supplier
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Order টি supplier-এর কাছে পাঠান — সে courier করে পাঠাবে।
        </p>

        {loading ? (
          <p className="text-sm text-slate-500 py-4">Loading suppliers…</p>
        ) : active.length === 0 ? (
          <div className="text-sm text-slate-600 bg-slate-50 rounded-lg p-4">
            কোনো active supplier নেই।{" "}
            <a href="/admin/suppliers" className="text-amber-700 underline">
              Suppliers page
            </a>{" "}
            থেকে তৈরি করুন।
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {active.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelected(s.id)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition ${
                  selected === s.id
                    ? "border-amber-400 bg-amber-50"
                    : "border-slate-200 hover:border-slate-400"
                }`}
              >
                <span className="text-sm text-slate-900 font-medium">
                  {s.name}
                </span>
                <span className="text-xs text-slate-500">
                  cost ৳{(s.cost / 100).toLocaleString("en-BD")}
                </span>
              </button>
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2 mb-3">
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={pending || active.length === 0}
            className="flex-1 bg-gold text-ink font-semibold py-3 rounded-xl hover:brightness-110 transition disabled:opacity-50"
          >
            {pending ? "Forwarding…" : "📤 Forward Order"}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-xl text-slate-500 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
