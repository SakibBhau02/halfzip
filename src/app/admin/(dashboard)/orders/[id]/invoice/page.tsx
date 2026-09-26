import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatBDT } from "@/lib/utils";
import { numberToWords } from "@/lib/invoice";
import PrintButton from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function InvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: true, customer: true },
  });
  if (!order) notFound();
  const s = await getSettings();
  const vatRegistered = s.store_vat_registered === "true";

  return (
    <div className="bg-white text-slate-900">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print-page { padding: 0 !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between mb-6">
        <a href={`/admin/orders/${order.id}`} className="text-sm text-slate-600 hover:text-amber-700">
          ← Back to order
        </a>
        <PrintButton />
      </div>

      <div className="print-page mx-auto max-w-[800px] p-4 sm:p-8 border border-slate-200 rounded-xl">
        {/* header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b-2 border-slate-900">
          <div>
            <h1 className="font-display text-3xl font-bold">{s.store_name}</h1>
            <p className="text-sm text-slate-600 mt-1 whitespace-pre-line">
              {s.store_address}
            </p>
            {s.store_phone && (
              <p className="text-sm text-slate-600">Phone: {s.store_phone}</p>
            )}
            {s.store_email && (
              <p className="text-sm text-slate-600">Email: {s.store_email}</p>
            )}
            {s.store_bin && (
              <p className="text-sm text-slate-700 font-medium mt-1">
                BIN: {s.store_bin}
                {vatRegistered ? " (VAT Registered)" : " (Turnover Tax)"}
              </p>
            )}
          </div>
          <div className="sm:text-right">
            <p className="text-2xl font-bold uppercase tracking-wider text-slate-900">
              {vatRegistered ? "Tax Invoice" : "Invoice"}
            </p>
            <p className="text-sm mt-2">
              <span className="text-slate-500">Invoice #:</span>{" "}
              <span className="font-mono font-medium">
                {order.invoiceNumber ?? order.orderNumber}
              </span>
            </p>
            <p className="text-sm">
              <span className="text-slate-500">Order #:</span>{" "}
              <span className="font-mono">{order.orderNumber}</span>
            </p>
            <p className="text-sm">
              <span className="text-slate-500">Date:</span> {fmtDate(order.createdAt)}
            </p>
          </div>
        </div>

        {/* bill to */}
        <div className="grid grid-cols-2 gap-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
              Bill To
            </p>
            <p className="font-semibold text-slate-900">{order.shipName}</p>
            <p className="text-sm text-slate-600">{order.shipPhone}</p>
            {order.customer.email && (
              <p className="text-sm text-slate-600">{order.customer.email}</p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
              Ship To
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {order.shipAddress}
            </p>
            {order.shipDistrict && (
              <p className="text-sm text-slate-600">
                {order.shipThana ? order.shipThana + ", " : ""}
                {order.shipDistrict}
              </p>
            )}
            {order.shipLandmark && (
              <p className="text-sm text-slate-500">Landmark: {order.shipLandmark}</p>
            )}
          </div>
        </div>

        {/* table */}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="text-left px-3 py-2.5 font-medium">#</th>
              <th className="text-left px-3 py-2.5 font-medium">Item</th>
              <th className="text-center px-3 py-2.5 font-medium">SKU</th>
              <th className="text-center px-3 py-2.5 font-medium">Qty</th>
              <th className="text-right px-3 py-2.5 font-medium">Unit Price</th>
              <th className="text-right px-3 py-2.5 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it, i) => (
              <tr key={it.id} className="border-b border-slate-200">
                <td className="px-3 py-2.5">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <p className="font-medium">{it.productName}</p>
                  <p className="text-xs text-slate-500">{it.variantLabel}</p>
                </td>
                <td className="px-3 py-2.5 text-center text-xs font-mono text-slate-500">
                  {order.orderNumber.split("-").pop()}-{i + 1}
                </td>
                <td className="px-3 py-2.5 text-center">{it.quantity}</td>
                <td className="px-3 py-2.5 text-right">{formatBDT(it.unitPrice)}</td>
                <td className="px-3 py-2.5 text-right font-medium">
                  {formatBDT(it.unitPrice * it.quantity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* totals */}
        <div className="flex justify-end mt-5">
          <div className="w-72 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span>{formatBDT(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Delivery Charge</span>
              <span>{order.deliveryFee === 0 ? "Free" : formatBDT(order.deliveryFee)}</span>
            </div>
            {vatRegistered && (
              <div className="flex justify-between text-slate-600">
                <span>VAT (included)</span>
                <span>{formatBDT(Math.round(order.total * 0.05))}</span>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-slate-900 pt-2 text-base font-bold">
              <span>Grand Total</span>
              <span>{formatBDT(order.total)}</span>
            </div>
            {order.advancePaid > 0 && (
              <>
                <div className="flex justify-between text-slate-600">
                  <span>Advance Paid</span>
                  <span>- {formatBDT(order.advancePaid)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-900">
                  <span>COD Collectible</span>
                  <span>{formatBDT(order.total - order.advancePaid)}</span>
                </div>
              </>
            )}
            <div className="mt-2 bg-slate-900 text-white rounded-lg px-3 py-2.5 flex justify-between items-center">
              <span className="text-xs uppercase tracking-wider">Collect on Delivery</span>
              <span className="font-bold text-lg">
                {formatBDT(order.total - order.advancePaid)}
              </span>
            </div>
          </div>
        </div>

        {/* words */}
        <p className="text-sm mt-5 pt-4 border-t border-slate-200">
          <span className="text-slate-500">In Words: </span>
          <span className="font-medium italic">
            Taka {numberToWords((order.total - order.advancePaid) / 100)} Only
          </span>
        </p>

        {/* footer */}
        <div className="flex items-end justify-between mt-10 pt-5 border-t border-slate-200">
          <div className="text-xs text-slate-500 max-w-sm">
            <p className="italic">{s.invoice_footer}</p>
            <p className="mt-2">Payment Method: {order.paymentMethod}</p>
          </div>
          <div className="text-center">
            <div className="border-t border-slate-400 w-44 pt-1 mt-8">
              <p className="text-xs text-slate-500">Authorized Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
