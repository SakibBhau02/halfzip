import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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

export default async function SupplierInvoice({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const supplierId = (session?.user as { supplierId?: string }).supplierId!;

  const so = await prisma.supplierOrder.findFirst({
    where: { orderId: params.id, supplierId },
    include: { order: { include: { items: true } }, supplier: true },
  });
  if (!so) notFound();

  const itemsSubtotal = so.order.items.reduce(
    (s, i) => s + i.unitPrice * i.quantity,
    0
  );
  const collectible = so.order.total - so.order.advancePaid;

  return (
    <div className="bg-white text-slate-900">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between mb-6">
        <Link
          href={`/supplier/orders/${so.orderId}`}
          className="text-sm text-slate-600 hover:text-amber-700"
        >
          ← Back to order
        </Link>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-[800px] p-4 sm:p-8 border border-slate-200 rounded-xl">
        {/* header */}
        <div className="flex flex-col sm:flex-row justify-between gap-4 pb-5 border-b-2 border-slate-900">
          <div>
            <h1 className="font-display text-2xl font-bold">
              {so.supplier.company || so.supplier.name}
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              {so.supplier.address ?? ""}
            </p>
            <p className="text-sm text-slate-600">Phone: {so.supplier.phone}</p>
            <p className="text-xs text-slate-500 mt-1">
              Supplier: {so.supplier.name}
            </p>
          </div>
          <div className="sm:text-right">
            <p className="text-xl font-bold uppercase tracking-wider">
              Packing Invoice
            </p>
            <p className="text-sm mt-2">
              <span className="text-slate-500">Order #:</span>{" "}
              <span className="font-mono">{so.order.orderNumber}</span>
            </p>
            <p className="text-sm">
              <span className="text-slate-500">Date:</span>{" "}
              {fmtDate(so.forwardedAt)}
            </p>
            {so.trackingId && (
              <p className="text-sm">
                <span className="text-slate-500">Tracking:</span>{" "}
                <span className="font-mono">{so.trackingId}</span>
              </p>
            )}
          </div>
        </div>

        {/* ship to */}
        <div className="grid grid-cols-2 gap-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
              Deliver To
            </p>
            <p className="font-semibold">{so.order.shipName}</p>
            <p className="text-sm text-slate-600">{so.order.shipPhone}</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1">
              {so.order.shipAddress}
            </p>
            {so.order.shipDistrict && (
              <p className="text-sm text-slate-600">{so.order.shipDistrict}</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
              COD to Collect
            </p>
            <p className="text-3xl font-bold">{formatBDT(collectible)}</p>
            <p className="text-xs text-slate-500 mt-1">
              আপনার cost: {formatBDT(so.supplierCost)}
            </p>
          </div>
        </div>

        {/* items */}
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white">
              <th className="text-left px-3 py-2.5 font-medium">Item</th>
              <th className="text-center px-3 py-2.5 font-medium">Size / Color</th>
              <th className="text-center px-3 py-2.5 font-medium">Qty</th>
              <th className="text-center px-3 py-2.5 font-medium">✓</th>
            </tr>
          </thead>
          <tbody>
            {so.order.items.map((it) => (
              <tr key={it.id} className="border-b border-slate-200">
                <td className="px-3 py-3 font-medium">{it.productName}</td>
                <td className="px-3 py-3 text-center text-slate-600">
                  {it.variantLabel}
                </td>
                <td className="px-3 py-3 text-center font-bold">{it.quantity}</td>
                <td className="px-3 py-3 text-center">
                  <span className="inline-block w-5 h-5 border border-slate-400 rounded" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td className="px-3 py-3 font-semibold" colSpan={2}>
                Total Items
              </td>
              <td className="px-3 py-3 text-center font-bold">
                {so.order.items.reduce((s, i) => s + i.quantity, 0)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>

        <p className="text-sm mt-5 pt-4 border-t border-slate-200">
          <span className="text-slate-500">Collect in words: </span>
          <span className="font-medium italic">
            Taka {numberToWords(collectible / 100)} Only
          </span>
        </p>

        <div className="grid grid-cols-3 gap-4 mt-10">
          {["Picked by", "Packed by", "Rider signature"].map((label) => (
            <div key={label} className="text-center">
              <div className="border-t border-slate-400 pt-1 mt-8">
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
