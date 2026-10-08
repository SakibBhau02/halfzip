import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBDT, formatDate } from "@/lib/utils";
import SupplierOrderActions from "@/components/supplier/SupplierOrderActions";
import CourierSyncButton from "@/components/CourierSyncButton";
import { steadfastStatusBn } from "@/lib/steadfast";

export const dynamic = "force-dynamic";

export default async function SupplierOrderDetail({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const supplierId = (session?.user as { supplierId?: string }).supplierId!;

  const so = await prisma.supplierOrder.findFirst({
    where: { orderId: params.id, supplierId },
    include: {
      order: { include: { items: true } },
      supplier: { include: { credentials: true } },
    },
  });
  if (!so) notFound();

  const credentials = so.supplier.credentials.map((c) => ({
    provider: c.provider,
    active: c.active,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/supplier/orders" className="text-xs text-slate-400 hover:text-amber-700">
          ← Back to orders
        </Link>
        <div className="flex flex-wrap items-center gap-2 mt-1">
          <h1 className="font-mono text-2xl font-bold text-slate-900">
            {so.order.orderNumber}
          </h1>
          <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600 ring-1 ring-slate-200">
            {so.order.status}
          </span>
        </div>
        {so.forwardCode && (
          <div className="mt-2 inline-flex items-center gap-2 bg-amber-50 border border-dashed border-amber-300 rounded-lg px-3 py-1.5">
            <span className="text-[11px] text-slate-500">Forward Code:</span>
            <span className="font-mono text-sm font-bold tracking-widest text-slate-900">
              {so.forwardCode}
            </span>
          </div>
        )}
        <p className="text-sm text-slate-500 mt-1">
          Forwarded {formatDate(so.forwardedAt)} · Your cost{" "}
          <b className="text-slate-900">{formatBDT(so.supplierCost)}</b>
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* items */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-slate-900 font-semibold">Items to Prepare</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {so.order.items.map((it) => (
                <div key={it.id} className="px-5 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-slate-900 font-medium">{it.productName}</p>
                    <p className="text-xs text-slate-500">
                      {it.variantLabel} · Qty {it.quantity}
                    </p>
                  </div>
                  <span className="text-slate-900">{formatBDT(it.unitPrice)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* deliver to */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-slate-900 font-semibold mb-3">Deliver To</h2>
            <p className="text-slate-900 font-medium">{so.order.shipName}</p>
            <p className="text-sm text-slate-600">{so.order.shipPhone}</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1">
              {so.order.shipAddress}
            </p>
            {so.order.shipDistrict && (
              <p className="text-xs text-slate-500 mt-1">{so.order.shipDistrict}</p>
            )}
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-xs text-slate-500">COD Amount (customer pays)</p>
              <p className="font-display text-xl text-slate-900">
                {formatBDT(so.order.total)}
              </p>
            </div>
          </div>

          {/* payment summary */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-slate-900 font-semibold mb-3">Payment Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Order Total</span>
                <span className="text-slate-900 font-medium">
                  {formatBDT(so.order.total)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Advance Paid</span>
                <span className="text-slate-900">{formatBDT(so.order.advancePaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Collect on Delivery</span>
                <span className="text-slate-900 font-bold">
                  {formatBDT(so.order.total - so.order.advancePaid)}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="text-slate-500">Payment Status</span>
                <span className="text-slate-900">{so.order.paymentStatus}</span>
              </div>
            </div>
          </div>

          {/* এই order-এর হিসাব — courier truth */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <h2 className="text-slate-900 font-semibold mb-3">
              এই Order-এর হিসাব
            </h2>
            {(() => {
              const collected =
                so.order.codCollected > 0 ? so.order.codCollected : so.order.total;
              return (
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">
                      {so.order.codCollected > 0 ? "তুলেছে (courier final)" : "তুলবে (COD)"}
                    </span>
                    <span className="text-slate-900 font-medium">
                      {formatBDT(collected)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">আপনার cost (কেনা)</span>
                    <span className="text-slate-900">
                      − {formatBDT(so.supplierCost)}
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 mt-1 border-t border-amber-200">
                    <span className="text-slate-900 font-semibold">
                      Reseller-এর লাভ
                    </span>
                    <span className="text-emerald-600 font-bold">
                      {formatBDT(collected - so.supplierCost)}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] pt-1 ${
                      so.status === "DELIVERED"
                        ? "text-emerald-600"
                        : "text-slate-500"
                    }`}
                  >
                    {so.status === "DELIVERED"
                      ? "✓ Delivered — এই লাভ reseller-এর পাওনায় যোগ হয়েছে, আপনাকে দিতে হবে"
                      : "⏳ Courier final এলে auto হিসাব হবে"}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>

        <div className="space-y-6">
          <Link
            href={`/supplier/orders/${so.orderId}/invoice`}
            target="_blank"
            className="block text-center bg-slate-900 text-white text-sm font-semibold py-3 rounded-xl hover:bg-slate-800 transition"
          >
            🧾 Packing Invoice
          </Link>

          <SupplierOrderActions
            orderId={so.orderId}
            status={so.status}
            credentials={credentials}
            trackingId={so.trackingId}
            consignmentId={so.consignmentId}
            courierProvider={so.courierProvider}
          />

          {so.courierProvider === "STEADFAST" && so.trackingId && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <h2 className="text-slate-900 font-semibold">Courier Status</h2>
              <div className="text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Steadfast</span>
                  <span className="text-slate-900 font-medium">
                    {steadfastStatusBn(so.courierStatus)}
                  </span>
                </div>
                {so.statusCheckedAt && (
                  <p className="text-[11px] text-slate-400 text-right">
                    Last checked {formatDate(so.statusCheckedAt)}
                  </p>
                )}
              </div>
              <CourierSyncButton orderId={so.orderId} variant="supplier" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
