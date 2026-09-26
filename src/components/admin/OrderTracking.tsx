"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCourier } from "@/app/admin/(dashboard)/orders/actions";

const COURIERS = ["Pathao", "RedX", "Steadfast", "Sundarban", "Paperfly", "Other"];

export default function OrderTracking({
  orderId,
  courierName,
  courierService,
  trackingId,
  trackingUrl,
}: {
  orderId: string;
  courierName: string;
  courierService: string;
  trackingId: string;
  trackingUrl: string;
}) {
  const router = useRouter();
  const [courier, setCourier] = useState(courierName);
  const [service, setService] = useState(courierService);
  const [track, setTrack] = useState(trackingId);
  const [url, setUrl] = useState(trackingUrl);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const save = () =>
    start(async () => {
      await updateCourier(orderId, {
        courierName: courier,
        courierService: service,
        trackingId: track,
        trackingUrl: url,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      router.refresh();
    });

  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="text-slate-900 font-semibold mb-3">Courier & Tracking</h2>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Courier</label>
            <select value={courier} onChange={(e) => setCourier(e.target.value)} className={inputCls}>
              <option value="">Select…</option>
              {COURIERS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Service</label>
            <select value={service} onChange={(e) => setService(e.target.value)} className={inputCls}>
              <option value="">—</option>
              <option value="Standard">Standard</option>
              <option value="Express">Express</option>
              <option value="Same-day">Same-day</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Tracking ID</label>
          <input value={track} onChange={(e) => setTrack(e.target.value)} className={inputCls} placeholder="Consignment / tracking number" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Tracking URL</label>
          <input value={url} onChange={(e) => setUrl(e.target.value)} className={inputCls} placeholder="https://…" />
        </div>
        <button
          onClick={save}
          disabled={pending}
          className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium py-2.5 rounded-lg transition disabled:opacity-50"
        >
          {saved ? "Saved ✓" : pending ? "Saving…" : "Save Courier Info"}
        </button>
      </div>
    </div>
  );
}
