import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatBDT, formatDate } from "@/lib/utils";
import {
  ALLOWED_TRANSITIONS,
  STATUS_LABELS,
  STATUS_STYLES,
  ALL_STATUSES,
} from "@/lib/order-status";
import OrderActions from "@/components/admin/OrderActions";
import OrderTracking from "@/components/admin/OrderTracking";
import OrderNotes from "@/components/admin/OrderNotes";
import OrderEdit from "@/components/admin/OrderEdit";
import PaymentTracker from "@/components/admin/PaymentTracker";
import InvoiceActions from "@/components/admin/InvoiceActions";
import Communication from "@/components/admin/Communication";
import CourierSyncButton from "@/components/CourierSyncButton";
import { steadfastStatusBn } from "@/lib/steadfast";

export const dynamic = "force-dynamic";

const STEPS = ["NEW", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as const;

export default async function OrderDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      items: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
      auditLogs: { orderBy: { createdAt: "desc" } },
      conversions: { orderBy: { createdAt: "desc" } },
      supplierOrder: { include: { supplier: true } },
    },
  });
  if (!order) notFound();

  const product = await prisma.product.findFirst();
  const settings = await getSettings();
  const nextStatuses = ALLOWED_TRANSITIONS[order.status];
  const isTerminal = ["CANCELLED", "RETURNED"].includes(order.status);
  const collectible = order.total - order.advancePaid;
  const currentStep = STEPS.indexOf(order.status as (typeof STEPS)[number]);

  return (
    <div className="space-y-6">
      {/* sticky header */}
      <div className="sticky top-0 z-20 -mx-5 md:-mx-8 px-5 md:px-8 py-4 bg-white/95 backdrop-blur border-b border-slate-200">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/orders"
              className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-50 transition"
              aria-label="Back"
            >
              ←
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-mono text-xl font-bold text-slate-900">
                  {order.orderNumber}
                </h1>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full ring-1 ${
                    STATUS_STYLES[order.status]
                  }`}
                >
                  {STATUS_LABELS[order.status]}
                </span>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-600">
                  {order.paymentMethod}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {formatDate(order.createdAt)} · via {order.source}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            <div className="text-right">
              <p className="text-xs text-slate-500">COD Collectible</p>
              <p className="font-display text-2xl text-slate-900">
                {formatBDT(collectible)}
              </p>
            </div>
          </div>
        </div>

        {/* status stepper */}
        {!isTerminal && (
          <div className="flex items-center gap-1 mt-4 overflow-x-auto">
            {STEPS.map((step, i) => (
              <div key={step} className="flex items-center flex-1 min-w-0">
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      i <= currentStep
                        ? "bg-amber-400 text-slate-900"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {i < currentStep ? "✓" : i + 1}
                  </span>
                  <span
                    className={`text-xs font-medium whitespace-nowrap ${
                      i <= currentStep ? "text-slate-900" : "text-slate-400"
                    }`}
                  >
                    {STATUS_LABELS[step]}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <span
                    className={`h-0.5 flex-1 mx-2 rounded ${
                      i < currentStep ? "bg-amber-400" : "bg-slate-200"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* LEFT */}
        <div className="lg:col-span-2 space-y-6">
          {/* items */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-slate-900 font-semibold">
                Items ({order.items.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {order.items.map((it) => (
                <div key={it.id} className="px-5 py-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-slate-900 font-medium">{it.productName}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {it.variantLabel} · Qty {it.quantity}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-slate-900 font-medium">
                      {formatBDT(it.unitPrice * it.quantity)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatBDT(it.unitPrice)} each
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-slate-200 space-y-2 text-sm bg-slate-50">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal</span>
                <span>{formatBDT(order.subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Delivery</span>
                <span>
                  {order.deliveryFee === 0 ? "Free" : formatBDT(order.deliveryFee)}
                </span>
              </div>
              <div className="flex justify-between text-slate-900 font-bold text-lg pt-2 border-t border-slate-200">
                <span>Total</span>
                <span>{formatBDT(order.total)}</span>
              </div>
            </div>
          </div>

          {/* timeline */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-slate-900 font-semibold">Order Timeline</h2>
            </div>
            <ol className="px-5 py-4 space-y-4">
              {[...order.statusHistory].reverse().map((h, i, arr) => (
                <li key={h.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1.5" />
                    {i < arr.length - 1 && (
                      <span className="w-px flex-1 bg-slate-100 mt-1" />
                    )}
                  </div>
                  <div className="pb-1">
                    <p className="text-sm text-slate-900 font-medium">
                      {h.from ? `${STATUS_LABELS[h.from]} → ` : ""}
                      {STATUS_LABELS[h.to]}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDate(h.createdAt)} · {h.actor ?? "system"}
                    </p>
                    {h.note && (
                      <p className="text-xs text-slate-600 mt-1 italic">“{h.note}”</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* audit log */}
          {order.auditLogs.length > 0 && (            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-slate-900 font-semibold">Audit Log</h2>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {order.auditLogs.map((a) => (
                  <div key={a.id} className="px-5 py-2.5 flex items-center justify-between">
                    <span className="text-slate-700">
                      <span className="font-medium">{a.action}</span>
                      {a.field && (
                        <span className="text-slate-500">
                          {" "}
                          — {a.field}
                          {a.newValue ? `: ${a.newValue}` : ""}
                        </span>
                      )}
                    </span>
                    <span className="text-slate-400">
                      {a.actor} · {formatDate(a.createdAt)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* server conversion fires (courier truth) */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-slate-900 font-semibold">📡 Ad Conversions</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Courier delivered বললেই Purchase যায় — তার আগে কিছু যায় না।
              </p>
            </div>
            {order.conversions.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-500">
                এখনো কোনো conversion fire হয়নি। Delivered হলে Meta / GA4 / TikTok-এ
                Purchase যাবে।
              </p>
            ) : (
              <div className="divide-y divide-slate-100 text-sm">
                {order.conversions.map((c) => (
                  <div key={c.id} className="px-5 py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-slate-900 font-medium">
                        {c.destination} · {c.eventName}
                        {c.testMode && (
                          <span className="ml-2 text-[10px] font-medium bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded">
                            TEST
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {formatDate(c.createdAt)}
                        {c.detail ? ` · ${c.detail}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-slate-900 font-medium">
                        {formatBDT(c.value)}
                      </p>
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                          c.status === "SENT"
                            ? "bg-emerald-50 text-emerald-600"
                            : c.status === "FAILED"
                              ? "bg-rose-50 text-rose-600"
                              : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <OrderNotes orderId={order.id} initial={order.notes ?? ""} />
        </div>

        {/* RIGHT */}
        <div className="space-y-6">
          <OrderActions orderId={order.id} nextStatuses={nextStatuses} />

          {/* supplier forward */}
          {order.supplierOrder && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h2 className="text-slate-900 font-semibold mb-3">
                Supplier Forward
              </h2>
              {order.supplierOrder.forwardCode && (
                <div className="bg-amber-50 border border-dashed border-amber-300 rounded-lg px-3 py-2.5 text-center mb-3">
                  <p className="text-[11px] text-slate-500">Forward Code</p>
                  <p className="font-mono font-bold tracking-widest text-slate-900">
                    {order.supplierOrder.forwardCode}
                  </p>
                </div>
              )}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Supplier</span>
                  <span className="text-slate-900 font-medium">
                    {order.supplierOrder.supplier.name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Supplier Status</span>
                  <span className="text-slate-900 font-medium">
                    {order.supplierOrder.status}
                  </span>
                </div>
                {/* supplier progress timestamps — every change visible */}
                <div className="pt-1 space-y-1 text-xs">
                  {(
                    [
                      ["Accepted", order.supplierOrder.acceptedAt],
                      ["Shipped", order.supplierOrder.shippedAt],
                      ["Delivered", order.supplierOrder.deliveredAt],
                    ] as [string, Date | null][]
                  ).map(
                    ([label, at]) =>
                      at ? (
                        <div key={label} className="flex justify-between">
                          <span className="text-slate-400">✓ {label}</span>
                          <span className="text-slate-500">{formatDate(at)}</span>
                        </div>
                      ) : null
                  )}
                </div>
                {order.supplierOrder.courierProvider && (
                  <div className="pt-2 mt-1 border-t border-slate-100 space-y-1.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Courier</span>
                      <span className="text-slate-900">
                        {order.supplierOrder.courierProvider}
                        {order.supplierOrder.trackingId
                          ? ` · ${order.supplierOrder.trackingId}`
                          : ""}
                      </span>
                    </div>
                    {order.supplierOrder.consignmentId && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Consignment</span>
                        <span className="font-mono text-slate-900">
                          {order.supplierOrder.consignmentId}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-slate-500">Courier Status</span>
                      <span className="text-slate-900 font-medium">
                        {steadfastStatusBn(order.supplierOrder.courierStatus)}
                      </span>
                    </div>
                    {order.codCollected > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Courier Collected</span>
                        <span className="text-emerald-600 font-bold">
                          {formatBDT(order.codCollected)}
                        </span>
                      </div>
                    )}
                    {order.supplierOrder.statusCheckedAt && (
                      <p className="text-[11px] text-slate-400 text-right">
                        Last checked{" "}
                        {formatDate(order.supplierOrder.statusCheckedAt)}
                      </p>
                    )}
                  </div>
                )}
                <p className="text-xs text-slate-400 pt-1">
                  Forwarded {formatDate(order.supplierOrder.forwardedAt)}
                </p>
              </div>
              {order.supplierOrder.courierProvider === "STEADFAST" && (
                <div className="mt-3">
                  <CourierSyncButton orderId={order.id} variant="admin" />
                </div>
              )}
            </div>
          )}

          <InvoiceActions
            orderId={order.id}
            hasInvoice={!!order.invoiceNumber}
            whatsappNumber={settings.whatsapp_number}
          />

          <PaymentTracker
            orderId={order.id}
            total={order.total}
            advancePaid={order.advancePaid}
            codCollected={order.codCollected}
            paymentStatus={order.paymentStatus}
          />

          {/* reseller margin breakdown — courier truth */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-slate-900 font-semibold mb-3">
              My Margin Breakdown
            </h2>
            {order.supplierOrder ? (
              (() => {
                const collected =
                  order.codCollected > 0 ? order.codCollected : order.total;
                const margin = collected - order.supplierCost;
                return (
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">
                        {order.codCollected > 0 ? "তুলেছে (courier final)" : "তুলবে (order total)"}
                      </span>
                      <span className="text-slate-900 font-medium">
                        {formatBDT(collected)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">কেনা (supplier cost)</span>
                      <span className="text-slate-900">
                        − {formatBDT(order.supplierCost)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 mt-1 border-t border-slate-100">
                      <span className="text-slate-900 font-semibold">আমার লাভ</span>
                      <span className="text-emerald-600 font-bold">
                        {formatBDT(margin)}
                      </span>
                    </div>
                    <p
                      className={`text-[11px] pt-1 ${
                        order.status === "DELIVERED"
                          ? "text-emerald-600"
                          : "text-slate-400"
                      }`}
                    >
                      {order.status === "DELIVERED"
                        ? "✓ Delivered — margin আপনার পাওনায় যোগ হয়েছে"
                        : "⏳ Courier final এলে auto হিসাব হবে — হাতে কিছু করতে হবে না"}
                    </p>
                  </div>
                );
              })()
            ) : (
              <p className="text-sm text-slate-500">
                Supplier-এর কাছে forward করলে এখানে তুলেছে vs কেনা vs লাভ দেখা যাবে।
              </p>
            )}
          </div>

          <Communication
            phone={order.shipPhone}
            orderNumber={order.orderNumber}
            customerName={order.shipName}
          />

          <OrderEdit
            orderId={order.id}
            initial={{
              customerName: order.shipName,
              phone: order.shipPhone,
              address: order.shipAddress,
              district: order.shipDistrict ?? "",
              notes: order.notes ?? "",
              zone:
                product && order.deliveryFee === product.insideFee
                  ? "inside"
                  : "outside",
            }}
          />

          <OrderTracking
            orderId={order.id}
            courierName={order.courierName ?? ""}
            courierService={order.courierService ?? ""}
            trackingId={order.trackingId ?? ""}
            trackingUrl={order.trackingUrl ?? ""}
          />

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-slate-900 font-semibold mb-3">Customer</h2>
            <div className="space-y-1.5 text-sm">
              <p className="text-slate-900 font-medium">
                {order.customer.name ?? order.shipName}
              </p>
              <a
                href={`tel:${order.shipPhone}`}
                className="block text-amber-700 hover:underline"
              >
                {order.shipPhone}
              </a>
              {order.customer.email && (
                <p className="text-slate-600">{order.customer.email}</p>
              )}
              <Link
                href={`/admin/customers/${order.customerId}`}
                className="inline-block text-xs text-slate-500 hover:text-amber-700 mt-1"
              >
                View full profile →
              </Link>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h2 className="text-slate-900 font-semibold mb-3">Shipping</h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {order.shipAddress}
            </p>
            {order.shipDistrict && (
              <p className="text-xs text-slate-500 mt-2">
                {order.shipThana ? order.shipThana + ", " : ""}
                {order.shipDistrict}
              </p>
            )}
            {order.shipLandmark && (
              <p className="text-xs text-slate-500">Landmark: {order.shipLandmark}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
