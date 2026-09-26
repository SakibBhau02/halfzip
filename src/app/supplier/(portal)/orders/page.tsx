import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatBDT, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "New Forward",
  ACCEPTED: "Accepted",
  PACKED: "Packed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
  CANCELLED: "Cancelled",
};
const STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-blue-50 text-blue-600 ring-blue-200",
  ACCEPTED: "bg-indigo-50 text-indigo-600 ring-indigo-200",
  PACKED: "bg-amber-50 text-amber-700 ring-amber-200",
  SHIPPED: "bg-purple-50 text-purple-600 ring-purple-200",
  DELIVERED: "bg-emerald-50 text-emerald-600 ring-emerald-200",
  RETURNED: "bg-orange-50 text-orange-600 ring-orange-200",
  CANCELLED: "bg-rose-50 text-rose-600 ring-rose-200",
};

export default async function SupplierOrders() {
  const session = await auth();
  const supplierId = (session?.user as { supplierId?: string }).supplierId!;

  const orders = await prisma.supplierOrder.findMany({
    where: { supplierId },
    orderBy: { forwardedAt: "desc" },
    include: { order: { include: { items: true } } },
    take: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-slate-900">Orders</h1>
        <p className="text-sm text-slate-500 mt-1">
          আপনার কাছে forward করা সব order
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {["Order", "Customer", "Items", "Your Cost", "Status", "Date"].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500">
                    কোনো order নেই।
                  </td>
                </tr>
              )}
              {orders.map((so) => (
                <tr key={so.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <Link
                      href={`/supplier/orders/${so.orderId}`}
                      className="text-amber-700 hover:underline font-medium font-mono"
                    >
                      {so.order.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-900">{so.order.shipName}</p>
                    <p className="text-xs text-slate-500">{so.order.shipPhone}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {so.order.items.map((i) => i.variantLabel).join(", ")}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {formatBDT(so.supplierCost)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-[11px] font-medium px-2 py-1 rounded-full ring-1 whitespace-nowrap ${
                        STATUS_STYLE[so.status]
                      }`}
                    >
                      {STATUS_LABEL[so.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatDate(so.forwardedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
