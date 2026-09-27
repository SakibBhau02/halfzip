"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatBDT, formatDate } from "@/lib/utils";
import { STATUS_LABELS, STATUS_STYLES } from "@/lib/order-status";
import type { OrderStatus } from "@prisma/client";
import ForwardModal from "./ForwardModal";

export type RowOrder = {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: string;
  total: number;
  shipName: string;
  shipPhone: string;
  shipDistrict: string | null;
  itemCount: number;
  createdAt: string;
  forwardedTo: string | null;
  forwardCode: string | null;
};

export default function OrdersTable({ orders }: { orders: RowOrder[] }) {
  const router = useRouter();
  const [forwardId, setForwardId] = useState<string | null>(null);
  const [, start] = useTransition();

  return (
    <>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[840px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {[
                  "Order",
                  "Customer",
                  "District",
                  "Items",
                  "Total",
                  "Payment",
                  "Status",
                  "Supplier",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left font-medium whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                    কোনো order পাওয়া যায়নি।
                  </td>
                </tr>
              )}
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className="hover:bg-amber-50/50 transition cursor-pointer"
                >
                  <td className="px-4 py-3" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                    <span className="text-amber-700 hover:underline font-medium font-mono">
                      {o.orderNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                    <p className="text-slate-900 font-medium">{o.shipName}</p>
                    <a
                      href={`tel:${o.shipPhone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-slate-500 hover:text-amber-700"
                    >
                      {o.shipPhone}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-slate-600" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                    {o.shipDistrict ?? "—"}
                  </td>
                  <td className="px-4 py-3" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                    <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-600">
                      {o.itemCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-display text-slate-900 whitespace-nowrap" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                    {formatBDT(o.total)}
                  </td>
                  <td className="px-4 py-3" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                    <span className="text-xs text-slate-500">{o.paymentMethod}</span>
                    <span
                      className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${
                        o.paymentStatus === "PAID"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {o.paymentStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={() => router.push(`/admin/orders/${o.id}`)}>
                    <span
                      className={`text-[11px] font-medium px-2 py-1 rounded-full ring-1 whitespace-nowrap ${
                        STATUS_STYLES[o.status]
                      }`}
                    >
                      {STATUS_LABELS[o.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {o.forwardedTo ? (
                      <div className="whitespace-nowrap">
                        <p className="text-xs text-emerald-600 font-medium">
                          ✓ {o.forwardedTo}
                        </p>
                        {o.forwardCode && (
                          <p className="text-[11px] font-mono text-slate-500">
                            {o.forwardCode}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setForwardId(o.id);
                      }}
                      disabled={!!o.forwardedTo}
                      className={`text-[11px] font-medium px-3 py-1.5 rounded-lg whitespace-nowrap transition ${
                        o.forwardedTo
                          ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                          : "bg-slate-900 text-white hover:bg-slate-700"
                      }`}
                    >
                      {o.forwardedTo ? "Forwarded" : "Forward →"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {forwardId && (
        <ForwardModal
          orderId={forwardId}
          onClose={() => setForwardId(null)}
          onDone={() => {
            setForwardId(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
