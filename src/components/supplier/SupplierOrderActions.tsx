"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CourierProvider, SupplierOrderStatus } from "@prisma/client";
import {
  updateSupplierOrderStatus,
  bookCourier,
} from "@/app/supplier/actions";

const LABELS: Record<SupplierOrderStatus, string> = {
  PENDING: "New Forward",
  ACCEPTED: "Accepted",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};

const COURIERS: CourierProvider[] = [
  "PATHAO",
  "REDX",
  "STEADFAST",
  "SUNDARBAN",
  "PAPERFLY",
  "OTHER",
];

export default function SupplierOrderActions({
  orderId,
  status,
  credentials,
  trackingId,
  courierProvider,
}: {
  orderId: string;
  status: SupplierOrderStatus;
  credentials: { provider: CourierProvider; active: boolean }[];
  trackingId: string | null;
  courierProvider: CourierProvider | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [manualId, setManualId] = useState("");
  const [provider, setProvider] = useState<CourierProvider>(
    courierProvider ?? credentials[0]?.provider ?? "PATHAO"
  );

  const notify = (m: string) => {
    setMsg(m);
    setTimeout(() => setMsg(""), 3000);
  };

  const setStatus = (to: SupplierOrderStatus) =>
    start(async () => {
      const res = await updateSupplierOrderStatus(orderId, to);
      if (!res.ok) notify(res.error ?? "Failed");
      else {
        notify(`Marked as ${LABELS[to]}`);
        router.refresh();
      }
    });

  const book = () =>
    start(async () => {
      const res = await bookCourier(orderId, provider, manualId);
      if (!res.ok) notify(res.error ?? "Failed");
      else {
        notify(`Courier booked ✓ ${res.trackingId ?? ""}`);
        router.refresh();
      }
    });

  const hasProviderCred = credentials.some((c) => c.provider === provider);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
      <h2 className="text-slate-900 font-semibold">Actions</h2>

      <div className="text-xs text-slate-500">
        Current: <b className="text-slate-900">{LABELS[status]}</b>
      </div>

      <a
        href={`/supplier/orders/${orderId}/invoice`}
        target="_blank"
        className="block text-center bg-slate-100 text-slate-700 text-sm font-medium py-2.5 rounded-lg hover:bg-slate-200 transition"
      >
        🧾 Print Invoice / Packing Slip
      </a>

      {/* status flow */}
      <div className="space-y-2">
        {status === "PENDING" && (
          <button
            onClick={() => setStatus("ACCEPTED")}
            disabled={pending}
            className="w-full bg-indigo-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-indigo-500 transition disabled:opacity-50"
          >
            ✓ Accept Order
          </button>
        )}
        {status === "ACCEPTED" && (
          <button
            onClick={() => setStatus("PACKED")}
            disabled={pending}
            className="w-full bg-amber-500 text-slate-900 text-sm font-semibold py-2.5 rounded-lg hover:bg-amber-400 transition disabled:opacity-50"
          >
            📦 Mark Packed
          </button>
        )}
        {status === "SHIPPED" && (
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setStatus("DELIVERED")}
              disabled={pending}
              className="bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-emerald-500 transition disabled:opacity-50"
            >
              Delivered
            </button>
            <button
              onClick={() => setStatus("RETURNED")}
              disabled={pending}
              className="bg-orange-500 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-orange-400 transition disabled:opacity-50"
            >
              Returned
            </button>
          </div>
        )}

        {(status === "PENDING" || status === "ACCEPTED") && (
          <button
            onClick={() =>
              confirm("Order cancel করবেন?") && setStatus("CANCELLED")
            }
            disabled={pending}
            className="w-full text-rose-600 text-sm py-2 rounded-lg hover:bg-rose-50 transition"
          >
            Cancel Order
          </button>
        )}
      </div>

      {/* book courier */}
      {(status === "ACCEPTED" || status === "PACKED") && (
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <p className="text-sm font-medium text-slate-900">Book Courier</p>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as CourierProvider)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400"
            >
              {COURIERS.map((c) => (
                <option key={c} value={c}>
                  {c} {credentials.some((x) => x.provider === c) ? "✓" : ""}
                </option>
              ))}
            </select>
          </div>
          {!hasProviderCred && (
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Manual Tracking ID
              </label>
              <input
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
                placeholder="Courier tracking number"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                {provider} credential নেই — manual tracking ID দিন।
              </p>
            </div>
          )}
          <button
            onClick={book}
            disabled={pending}
            className="w-full bg-slate-900 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
          >
            🚚 Book & Mark Shipped
          </button>
        </div>
      )}

      {trackingId && (
        <div className="bg-slate-50 rounded-lg p-3 text-sm">
          <p className="text-xs text-slate-500">Tracking</p>
          <p className="font-mono text-slate-900">{trackingId}</p>
          {courierProvider && (
            <p className="text-xs text-slate-500 mt-1">via {courierProvider}</p>
          )}
        </div>
      )}

      {msg && (
        <p className="text-xs text-slate-700 bg-slate-100 rounded-lg px-3 py-2">
          {msg}
        </p>
      )}
    </div>
  );
}
