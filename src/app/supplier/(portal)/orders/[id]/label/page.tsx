import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBDT } from "@/lib/utils";
import PrintButton from "@/components/admin/PrintButton";

export const dynamic = "force-dynamic";

/**
 * Printable courier shipping label for a booked order.
 * Supplier prints this and sticks it on the parcel.
 */
export default async function ShippingLabel({
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
  if (!so || !so.trackingId) notFound();

  const collectible = so.order.total - so.order.advancePaid;

  return (
    <div className="bg-white text-slate-900 min-h-screen">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          @page { size: A5 landscape; margin: 8mm; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between p-4 max-w-[700px] mx-auto">
        <Link
          href={`/supplier/orders/${so.orderId}`}
          className="text-sm text-slate-600 hover:text-amber-700"
        >
          ← Back to order
        </Link>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-[700px] p-4">
        <div className="border-2 border-slate-900 rounded-xl overflow-hidden">
          {/* header */}
          <div className="flex items-center justify-between px-5 py-3 border-b-2 border-slate-900">
            <div>
              <p className="font-bold text-lg leading-none">Half Zipper</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {so.supplier.company ?? so.supplier.name} · {so.supplier.phone}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-slate-500">Courier</p>
              <p className="font-bold">{so.courierProvider ?? "—"}</p>
            </div>
          </div>

          {/* tracking */}
          <div className="px-5 py-4 text-center border-b border-slate-300 bg-slate-50">
            <p className="text-[11px] uppercase tracking-widest text-slate-500">
              Tracking Code
            </p>
            <p className="font-mono font-bold text-3xl tracking-widest">
              {so.trackingId}
            </p>
            {so.consignmentId && (
              <p className="text-xs text-slate-500 mt-1 font-mono">
                Consignment: {so.consignmentId}
              </p>
            )}
            {so.forwardCode && (
              <p className="text-xs text-slate-500 font-mono">
                Forward: {so.forwardCode} · Order: {so.order.orderNumber}
              </p>
            )}
          </div>

          {/* recipient */}
          <div className="grid sm:grid-cols-2 sm:divide-x divide-y sm:divide-y-0 divide-slate-300 border-b border-slate-300">
            <div className="px-5 py-4">
              <p className="text-[11px] uppercase tracking-widest text-slate-500 mb-1">
                Deliver To
              </p>
              <p className="font-bold text-lg">{so.order.shipName}</p>
              <p className="font-mono">{so.order.shipPhone}</p>
              <p className="text-sm mt-1">{so.order.shipAddress}</p>
              {(so.order.shipThana || so.order.shipDistrict) && (
                <p className="text-xs text-slate-500">
                  {[so.order.shipThana, so.order.shipDistrict]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              )}
            </div>
            <div className="px-5 py-4 flex flex-col justify-center items-center text-center">
              <p className="text-[11px] uppercase tracking-widest text-slate-500">
                COD Collect
              </p>
              <p className="font-bold text-4xl">{formatBDT(collectible)}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {so.order.items.reduce((s, i) => s + i.quantity, 0)} pcs ·{" "}
                {so.order.items.map((i) => i.variantLabel).join(", ")}
              </p>
            </div>
          </div>

          {/* footer */}
          <div className="px-5 py-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Invoice: {so.order.invoiceNumber ?? so.order.orderNumber}
            </span>
            <span>
              Date:{" "}
              {new Date().toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
          </div>
        </div>
        <p className="no-print text-center text-xs text-slate-400 mt-3">
          প্রিন্ট করে পার্সেলের গায়ে লাগিয়ে দিন
        </p>
      </div>
    </div>
  );
}
