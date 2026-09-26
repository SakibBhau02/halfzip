import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import PrintButton from "@/components/admin/PrintButton";
import { formatBDT } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PackingSlipPage({
  params,
}: {
  params: { id: string };
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: { items: true },
  });
  if (!order) notFound();
  const s = await getSettings();

  return (
    <div className="bg-white text-slate-900">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .slip { border: none !important; }
          @page { size: A4; margin: 12mm; }
        }
      `}</style>

      <div className="no-print flex items-center justify-between mb-6">
        <a href={`/admin/orders/${order.id}`} className="text-sm text-slate-600 hover:text-amber-700">
          ← Back to order
        </a>
        <PrintButton />
      </div>

      <div className="slip mx-auto max-w-[800px] p-4 sm:p-8 border-2 border-dashed border-slate-300 rounded-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-slate-900">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Packing Slip
            </p>
            <h1 className="font-display text-2xl font-bold">{s.store_name}</h1>
          </div>
          <div className="text-right text-sm">
            <p className="font-mono font-bold text-lg">{order.orderNumber}</p>
            <p className="text-slate-500">
              {new Date(order.createdAt).toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
              Deliver To
            </p>
            <p className="font-semibold">{order.shipName}</p>
            <p className="text-sm text-slate-700">{order.shipPhone}</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap mt-1">
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
          <div className="sm:text-right">
            <p className="text-xs uppercase tracking-wider text-slate-500 mb-1">
              COD Amount
            </p>
            <p className="text-3xl font-bold text-slate-900">
              {formatBDT(order.total - order.advancePaid)}
            </p>
            <p className="text-xs text-slate-500 mt-1">Collect on delivery</p>
            {order.courierName && (
              <p className="text-sm text-slate-600 mt-3">
                Courier: <b>{order.courierName}</b>
              </p>
            )}
          </div>
        </div>

        <table className="w-full text-sm border-collapse mt-2">
          <thead>
            <tr className="bg-slate-100">
              <th className="text-left px-3 py-2.5 font-medium">Item</th>
              <th className="text-center px-3 py-2.5 font-medium">Size / Color</th>
              <th className="text-center px-3 py-2.5 font-medium">Qty</th>
              <th className="text-center px-3 py-2.5 font-medium">✓</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((it) => (
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
                {order.items.reduce((sum, i) => sum + i.quantity, 0)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>

        {order.notes && (
          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs uppercase tracking-wider text-amber-700 font-medium">
              Note for Packer
            </p>
            <p className="text-sm text-slate-700 mt-1">{order.notes}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 mt-10">
          {["Picked by", "Packed by", "Checked by"].map((label) => (
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
