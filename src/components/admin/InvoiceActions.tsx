"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  recordPrint,
  ensureInvoiceNumber,
} from "@/app/admin/(dashboard)/orders/actions";

export default function InvoiceActions({
  orderId,
  hasInvoice,
  whatsappNumber,
}: {
  orderId: string;
  hasInvoice: boolean;
  whatsappNumber: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const markPrint = () => start(async () => void (await recordPrint(orderId)));
  const genInvoice = () =>
    start(async () => {
      await ensureInvoiceNumber(orderId);
      router.refresh();
    });

  const invUrl = `/admin/orders/${orderId}/invoice`;
  const slipUrl = `/admin/orders/${orderId}/packing-slip`;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <h2 className="text-slate-900 font-semibold mb-3">Documents</h2>
      <div className="space-y-2">
        {!hasInvoice && (
          <button
            onClick={genInvoice}
            disabled={pending}
            className="w-full bg-amber-50 text-amber-800 border border-amber-200 text-sm font-medium py-2.5 rounded-lg hover:bg-amber-100 transition disabled:opacity-50"
          >
            Generate Invoice Number
          </button>
        )}
        <Link
          href={invUrl}
          target="_blank"
          onClick={markPrint}
          className="block text-center w-full bg-slate-900 text-white text-sm font-semibold py-2.5 rounded-lg hover:bg-slate-800 transition"
        >
          🧾 Tax Invoice
        </Link>
        <Link
          href={slipUrl}
          target="_blank"
          onClick={markPrint}
          className="block text-center w-full bg-slate-100 text-slate-700 text-sm font-medium py-2.5 rounded-lg hover:bg-slate-200 transition"
        >
          📦 Packing Slip
        </Link>
        <Link
          href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
            `আপনার অর্ডার সম্পর্কে জানাতে চাই।`
          )}`}
          target="_blank"
          className="block text-center w-full text-sm text-slate-500 py-2 hover:text-slate-800 transition"
        >
          Share on WhatsApp
        </Link>
      </div>
    </div>
  );
}
