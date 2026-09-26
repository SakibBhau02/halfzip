import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBDT, formatDate } from "@/lib/utils";
import SupplierOrderActions from "@/components/supplier/SupplierOrderActions";

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
        <h1 className="font-mono text-2xl font-bold text-slate-900 mt-1">
          {so.order.orderNumber}
        </h1>
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
            courierProvider={so.courierProvider}
          />
        </div>
      </div>
    </div>
  );
}
