"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatBDT, formatDate } from "@/lib/utils";
import {
  ALLOWED_TRANSITIONS,
  STATUS_LABELS,
  STATUS_STYLES,
  ALL_STATUSES,
} from "@/lib/order-status";
import type { OrderStatus } from "@prisma/client";
import {
  updateOrderStatus,
  updateOrderDetails,
  deleteOrder,
  recordCodCollected,
  recordAdvancePaid,
  updateCourier,
} from "@/app/admin/(dashboard)/orders/actions";
import {
  forwardOrderToSupplier,
  recallForward,
} from "@/app/admin/(dashboard)/suppliers/actions";

/* -------------------------------- types --------------------------------- */

type DrawerOrder = {
  id: string;
  orderNumber: string;
  invoiceNumber: string | null;
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: string;
  source: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
  advancePaid: number;
  codCollected: number;
  courierName: string | null;
  courierService: string | null;
  trackingId: string | null;
  trackingUrl: string | null;
  shipName: string;
  shipPhone: string;
  shipAddress: string;
  shipDistrict: string | null;
  shipThana: string | null;
  shipLandmark: string | null;
  notes: string | null;
  createdAt: string;
  customerId: string;
  customer: { id: string; name: string | null; email: string | null };
  items: {
    id: string;
    productName: string;
    variantLabel: string;
    quantity: number;
    unitPrice: number;
  }[];
  statusHistory: {
    id: string;
    from: OrderStatus | null;
    to: OrderStatus;
    actor: string | null;
    note: string | null;
    createdAt: string;
  }[];
  auditLogs: {
    id: string;
    action: string;
    field: string | null;
    newValue: string | null;
    actor: string | null;
    createdAt: string;
  }[];
};

const TABS = ["Details", "Edit", "Payment", "Courier", "Supplier", "History"] as const;
type Tab = (typeof TABS)[number];

const ACTION_STYLE: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: "bg-indigo-600 hover:bg-indigo-500 text-white",
  PROCESSING: "bg-amber-500 hover:bg-amber-400 text-slate-900",
  SHIPPED: "bg-purple-600 hover:bg-purple-500 text-white",
  DELIVERED: "bg-emerald-600 hover:bg-emerald-500 text-white",
  RETURNED: "bg-orange-500 hover:bg-orange-400 text-white",
  CANCELLED: "bg-rose-600 hover:bg-rose-500 text-white",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";
  return (
    <div>
      <label className="block text-xs font-medium text-slate-500 mb-1">
        {label}
      </label>
      {typeof children === "string" ? (
        <input className={inputCls} value={children} readOnly />
      ) : (
        children
      )}
    </div>
  );
}

export default function OrderDrawer({
  orderId,
  onClose,
}: {
  orderId: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Details");
  const [order, setOrder] = useState<DrawerOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState("");

  const notify = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, { cache: "no-store" });
      const data = await res.json();
      if (data.order) setOrder(data.order);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  // esc to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", h);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const refresh = () => {
    load();
    router.refresh();
  };

  /* ------------------------------- actions ------------------------------ */

  const changeStatus = (to: OrderStatus) =>
    start(async () => {
      const res = await updateOrderStatus(orderId, to);
      if (!res.ok) notify(res.error ?? "Failed");
      else {
        notify(`Status → ${STATUS_LABELS[to]}`);
        refresh();
      }
    });

  const saveDetails = (form: {
    customerName: string;
    phone: string;
    address: string;
    district: string;
    notes: string;
    zone: "inside" | "outside";
  }) =>
    start(async () => {
      const res = await updateOrderDetails(orderId, form);
      if (!res.ok) notify(res.error ?? "Failed");
      else {
        notify("Details saved ✓");
        refresh();
      }
    });

  const remove = () =>
    start(async () => {
      if (
        !confirm(
          `Order ${order?.orderNumber} মুছে ফেলবেন? Stock ফেরত যাবে। এটা undo করা যাবে না।`
        )
      )
        return;
      const res = await deleteOrder(orderId);
      if (res.ok) {
        router.refresh();
        onClose();
      } else notify(res.error ?? "Failed");
    });

  const saveCod = (amount: number) =>
    start(async () => {
      const res = await recordCodCollected(orderId, amount);
      if (!res.ok) notify(res.error ?? "Failed");
      else {
        notify("COD recorded ✓");
        refresh();
      }
    });

  const saveAdv = (amount: number) =>
    start(async () => {
      const res = await recordAdvancePaid(orderId, amount);
      if (!res.ok) notify(res.error ?? "Failed");
      else {
        notify("Advance recorded ✓");
        refresh();
      }
    });

  const saveCourier = (form: {
    courierName: string;
    courierService: string;
    trackingId: string;
    trackingUrl: string;
  }) =>
    start(async () => {
      const res = await updateCourier(orderId, form);
      if (!res.ok) notify(res.error ?? "Failed");
      else {
        notify("Courier saved ✓");
        refresh();
      }
    });

  const waNumber = order?.shipPhone.replace(/^0/, "880") ?? "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* modal */}
      <div className="relative w-full max-w-3xl max-h-[92vh] bg-slate-50 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-[popIn_.2s_ease-out]">
        <style>{`@keyframes popIn{from{transform:scale(.96);opacity:.5}to{transform:scale(1);opacity:1}}`}</style>

        {/* header */}
        {loading || !order ? (
          <div className="flex-1 flex items-center justify-center text-slate-400">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              Loading order…
            </div>
          </div>
        ) : (
          <>
            <div className="bg-white border-b border-slate-200 px-4 sm:px-6 pt-4 sm:pt-5 pb-0">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-mono text-xl font-bold text-slate-900">
                      {order.orderNumber}
                    </h2>
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
                  <p className="text-xs text-slate-500 mt-1">
                    {formatDate(order.createdAt)} · via {order.source}
                    {order.invoiceNumber ? ` · ${order.invoiceNumber}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[11px] text-slate-500">COD Collectible</p>
                    <p className="font-display text-xl text-slate-900">
                      {formatBDT(order.total - order.advancePaid)}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center hover:bg-slate-100 transition"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* tabs */}
              <div className="flex gap-1 mt-4 -mb-px overflow-x-auto">
                {TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`text-sm px-4 py-2.5 rounded-t-lg border-b-2 transition whitespace-nowrap ${
                      tab === t
                        ? "border-amber-400 text-slate-900 font-medium"
                        : "border-transparent text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">
              {tab === "Details" && (
                <DetailsTab order={order} onStatus={changeStatus} pending={pending} />
              )}
              {tab === "Edit" && (
                <EditTab order={order} onSave={saveDetails} onDelete={remove} pending={pending} />
              )}
              {tab === "Payment" && (
                <PaymentTab order={order} onCod={saveCod} onAdv={saveAdv} pending={pending} />
              )}
              {tab === "Courier" && (
                <CourierTab order={order} onSave={saveCourier} pending={pending} />
              )}
              {tab === "Supplier" && (
                <SupplierTab orderId={orderId} onDone={refresh} />
              )}
              {tab === "History" && <HistoryTab order={order} />}
            </div>

            {/* footer actions */}
            <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex flex-wrap items-center gap-2">
              <a
                href={`/admin/orders/${order.id}/invoice`}
                target="_blank"
                className="bg-slate-900 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-800 transition"
              >
                🧾 Invoice
              </a>
              <a
                href={`/admin/orders/${order.id}/packing-slip`}
                target="_blank"
                className="bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-200 transition"
              >
                📦 Packing Slip
              </a>
              <a
                href={`tel:${order.shipPhone}`}
                className="bg-slate-100 text-slate-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-slate-200 transition"
              >
                📞 Call
              </a>
              <a
                href={`https://wa.me/${waNumber}`}
                target="_blank"
                className="bg-emerald-50 text-emerald-700 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-emerald-100 transition"
              >
                🟢 WhatsApp
              </a>
              <div className="flex-1" />
              <button
                onClick={remove}
                disabled={pending}
                className="text-rose-600 text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-rose-50 transition disabled:opacity-50"
              >
                🗑 Delete
              </button>
            </div>
          </>
        )}
      </div>

      {/* toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white text-sm px-5 py-3 rounded-xl shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- Details -------------------------------- */

function DetailsTab({
  order,
  onStatus,
  pending,
}: {
  order: DrawerOrder;
  onStatus: (s: OrderStatus) => void;
  pending: boolean;
}) {
  const next = ALLOWED_TRANSITIONS[order.status];
  return (
    <div className="space-y-6">
      {/* status change */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-slate-900 font-semibold mb-3">Change Status</h3>
        {next.length === 0 ? (
          <p className="text-sm text-slate-500">
            এই status terminal — আর পরিবর্তন করা যাবে না।
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {next.map((s) => (
              <button
                key={s}
                disabled={pending}
                onClick={() => onStatus(s)}
                className={`text-sm font-medium px-4 py-2.5 rounded-lg transition disabled:opacity-50 ${
                  ACTION_STYLE[s] ?? "bg-slate-800 text-white"
                }`}
              >
                → {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* items */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-slate-900 font-semibold">
            Items ({order.items.length})
          </h3>
        </div>
        <div className="divide-y divide-slate-100">
          {order.items.map((it) => (
            <div key={it.id} className="px-5 py-3.5 flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-900 font-medium">{it.productName}</p>
                <p className="text-xs text-slate-500">
                  {it.variantLabel} · Qty {it.quantity}
                </p>
              </div>
              <p className="text-slate-900 font-medium">
                {formatBDT(it.unitPrice * it.quantity)}
              </p>
            </div>
          ))}
        </div>
        <div className="px-5 py-4 bg-slate-50 space-y-1.5 text-sm border-t border-slate-100">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatBDT(order.subtotal)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Delivery</span>
            <span>{order.deliveryFee === 0 ? "Free" : formatBDT(order.deliveryFee)}</span>
          </div>
          <div className="flex justify-between font-bold text-slate-900 pt-1.5 border-t border-slate-200">
            <span>Total</span>
            <span>{formatBDT(order.total)}</span>
          </div>
        </div>
      </div>

      {/* customer + shipping */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-slate-900 font-semibold mb-3">Customer</h3>
          <p className="text-sm text-slate-900 font-medium">
            {order.customer.name ?? order.shipName}
          </p>
          <a
            href={`tel:${order.shipPhone}`}
            className="text-sm text-amber-700 hover:underline"
          >
            {order.shipPhone}
          </a>
          {order.customer.email && (
            <p className="text-sm text-slate-500 mt-1">{order.customer.email}</p>
          )}
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-slate-900 font-semibold mb-3">Shipping</h3>
          <p className="text-sm text-slate-700 whitespace-pre-wrap">
            {order.shipAddress}
          </p>
          {order.shipDistrict && (
            <p className="text-xs text-slate-500 mt-1">
              {order.shipThana ? order.shipThana + ", " : ""}
              {order.shipDistrict}
            </p>
          )}
        </div>
      </div>

      {order.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <h3 className="text-amber-800 font-semibold mb-1 text-sm">Internal Note</h3>
          <p className="text-sm text-slate-700">{order.notes}</p>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- Edit --------------------------------- */

function EditTab({
  order,
  onSave,
  onDelete,
  pending,
}: {
  order: DrawerOrder;
  onSave: (f: {
    customerName: string;
    phone: string;
    address: string;
    district: string;
    notes: string;
    zone: "inside" | "outside";
  }) => void;
  onDelete: () => void;
  pending: boolean;
}) {
  const [name, setName] = useState(order.shipName);
  const [phone, setPhone] = useState(order.shipPhone);
  const [address, setAddress] = useState(order.shipAddress);
  const [district, setDistrict] = useState(order.shipDistrict ?? "");
  const [notes, setNotes] = useState(order.notes ?? "");
  const [zone, setZone] = useState<"inside" | "outside">(
    order.deliveryFee === 0 || order.deliveryFee === 6000 ? "inside" : "outside"
  );

  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <h3 className="text-slate-900 font-semibold">Edit Order</h3>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Customer Name">
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Phone">
            <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <Field label="Address">
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="District">
            <input className={inputCls} value={district} onChange={(e) => setDistrict(e.target.value)} />
          </Field>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Delivery Zone
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(["inside", "outside"] as const).map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZone(z)}
                  className={`py-2.5 rounded-lg border text-xs font-medium transition ${
                    zone === z
                      ? "bg-slate-900 text-white border-slate-900"
                      : "border-slate-200 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {z === "inside" ? "Inside Dhaka" : "Outside Dhaka"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <Field label="Internal Notes">
          <textarea
            className={`${inputCls} resize-none`}
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>
        <button
          onClick={() => onSave({ customerName: name, phone, address, district, notes, zone })}
          disabled={pending}
          className="w-full bg-gold text-ink font-semibold py-3 rounded-xl hover:brightness-110 transition disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save Changes"}
        </button>
      </div>

      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
        <h3 className="text-rose-800 font-semibold mb-1">Danger Zone</h3>
        <p className="text-xs text-rose-600 mb-3">
          Order মুছে ফেললে stock ফেরত যাবে এবং এটা undo করা যাবে না।
        </p>
        <button
          onClick={onDelete}
          disabled={pending}
          className="bg-rose-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-rose-500 transition disabled:opacity-50"
        >
          🗑 Delete Order
        </button>
      </div>
    </div>
  );
}

/* ------------------------------- Payment -------------------------------- */

function PaymentTab({
  order,
  onCod,
  onAdv,
  pending,
}: {
  order: DrawerOrder;
  onCod: (n: number) => void;
  onAdv: (n: number) => void;
  pending: boolean;
}) {
  const [cod, setCod] = useState((order.codCollected / 100).toString());
  const [adv, setAdv] = useState((order.advancePaid / 100).toString());
  const collectible = order.total - order.advancePaid;
  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <p className="text-xs text-slate-500">Order Total</p>
          <p className="font-display text-2xl text-slate-900">{formatBDT(order.total)}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-xs text-amber-700">COD Collectible</p>
          <p className="font-display text-2xl text-amber-800">{formatBDT(collectible)}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Advance Paid (৳)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              className={inputCls}
              value={adv}
              onChange={(e) => setAdv(e.target.value)}
            />
            <button
              onClick={() => onAdv(Math.round(Number(adv) * 100))}
              disabled={pending}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-5 rounded-lg transition disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            COD Collected (৳)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              className={inputCls}
              value={cod}
              onChange={(e) => setCod(e.target.value)}
            />
            <button
              onClick={() => onCod(Math.round(Number(cod) * 100))}
              disabled={pending}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm px-5 rounded-lg transition disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-sm">
          <span className="text-slate-500">Payment Status</span>
          <span
            className={`text-xs font-medium px-2.5 py-1 rounded-full ${
              order.paymentStatus === "PAID"
                ? "bg-emerald-50 text-emerald-600"
                : "bg-amber-50 text-amber-700"
            }`}
          >
            {order.paymentStatus}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- Courier -------------------------------- */

const COURIERS = ["Pathao", "RedX", "Steadfast", "Sundarban", "Paperfly", "Other"];

function CourierTab({
  order,
  onSave,
  pending,
}: {
  order: DrawerOrder;
  onSave: (f: {
    courierName: string;
    courierService: string;
    trackingId: string;
    trackingUrl: string;
  }) => void;
  pending: boolean;
}) {
  const [name, setName] = useState(order.courierName ?? "");
  const [service, setService] = useState(order.courierService ?? "");
  const [track, setTrack] = useState(order.trackingId ?? "");
  const [url, setUrl] = useState(order.trackingUrl ?? "");
  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
      <h3 className="text-slate-900 font-semibold">Courier & Tracking</h3>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Courier">
          <select className={inputCls} value={name} onChange={(e) => setName(e.target.value)}>
            <option value="">Select…</option>
            {COURIERS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Service">
          <select className={inputCls} value={service} onChange={(e) => setService(e.target.value)}>
            <option value="">—</option>
            <option value="Standard">Standard</option>
            <option value="Express">Express</option>
            <option value="Same-day">Same-day</option>
          </select>
        </Field>
      </div>
      <Field label="Tracking ID">
        <input className={inputCls} value={track} onChange={(e) => setTrack(e.target.value)} placeholder="Consignment number" />
      </Field>
      <Field label="Tracking URL">
        <input className={inputCls} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
      </Field>
      <button
        onClick={() => onSave({ courierName: name, courierService: service, trackingId: track, trackingUrl: url })}
        disabled={pending}
        className="w-full bg-gold text-ink font-semibold py-3 rounded-xl hover:brightness-110 transition disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save Courier Info"}
      </button>
    </div>
  );
}

/* ------------------------------- History -------------------------------- */

function HistoryTab({ order }: { order: DrawerOrder }) {
  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="text-slate-900 font-semibold">Order Timeline</h3>
        </div>
        <ol className="px-5 py-4 space-y-4">
          {[...order.statusHistory].reverse().map((h, i, arr) => (
            <li key={h.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 mt-1.5" />
                {i < arr.length - 1 && <span className="w-px flex-1 bg-slate-100 mt-1" />}
              </div>
              <div className="pb-1">
                <p className="text-sm text-slate-900 font-medium">
                  {h.from ? `${STATUS_LABELS[h.from]} → ` : ""}
                  {STATUS_LABELS[h.to]}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(h.createdAt)} · {h.actor ?? "system"}
                </p>
                {h.note && <p className="text-xs text-slate-600 mt-1 italic">“{h.note}”</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {order.auditLogs.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-slate-900 font-semibold">Audit Log</h3>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {order.auditLogs.map((a) => (
              <div key={a.id} className="px-5 py-2.5 flex items-center justify-between">
                <span className="text-slate-700">
                  <span className="font-medium">{a.action}</span>
                  {a.field && (
                    <span className="text-slate-500">
                      {" "}— {a.field}{a.newValue ? `: ${a.newValue}` : ""}
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
    </div>
  );
}

/* ------------------------------- Supplier -------------------------------- */

function SupplierTab({
  orderId,
  onDone,
}: {
  orderId: string;
  onDone: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<
    { id: string; name: string; active: boolean; cost: number }[]
  >([]);
  const [current, setCurrent] = useState<{
    supplierName: string;
    status: string;
    trackingId: string | null;
  } | null>(null);
  const [selected, setSelected] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sRes, oRes] = await Promise.all([
        fetch("/api/admin/suppliers", { cache: "no-store" }),
        fetch(`/api/admin/orders/${orderId}`, { cache: "no-store" }),
      ]);
      const sData = await sRes.json();
      const oData = await oRes.json();
      setSuppliers(sData.suppliers ?? []);
      if (oData.supplierOrder) {
        setCurrent({
          supplierName: oData.supplierOrder.supplier?.name ?? "Supplier",
          status: oData.supplierOrder.status,
          trackingId: oData.supplierOrder.trackingId,
        });
      } else setCurrent(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const forward = () =>
    start(async () => {
      setMsg("");
      if (!selected) {
        setMsg("Supplier নির্বাচন করুন।");
        return;
      }
      const res = await forwardOrderToSupplier(orderId, selected);
      if (!res.ok) setMsg(res.error ?? "Failed");
      else {
        setMsg("Forwarded ✓");
        await load();
        onDone();
      }
    });

  const recall = () =>
    start(async () => {
      if (!confirm("Supplier থেকে recall করবেন?")) return;
      const res = await recallForward(orderId);
      if (!res.ok) setMsg(res.error ?? "Failed");
      else {
        setMsg("Recalled ✓");
        await load();
        onDone();
      }
    });

  if (loading) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (current) {
    return (
      <div className="space-y-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-slate-900 font-semibold mb-3">Forwarded</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Supplier</span>
              <span className="text-slate-900 font-medium">
                {current.supplierName}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <span className="text-slate-900">{current.status}</span>
            </div>
            {current.trackingId && (
              <div className="flex justify-between">
                <span className="text-slate-500">Tracking</span>
                <span className="font-mono text-slate-900">
                  {current.trackingId}
                </span>
              </div>
            )}
          </div>
          {current.status === "PENDING" && (
            <button
              onClick={recall}
              disabled={pending}
              className="mt-4 w-full text-rose-600 text-sm py-2.5 rounded-lg border border-rose-200 hover:bg-rose-50 transition disabled:opacity-50"
            >
              Recall from Supplier
            </button>
          )}
        </div>
        {msg && (
          <p className="text-sm text-slate-700 bg-slate-100 rounded-lg px-3 py-2">
            {msg}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-slate-900 font-semibold mb-1">Forward to Supplier</h3>
        <p className="text-xs text-slate-500 mb-4">
          Supplier selector — order তার কাছে যাবে, সে courier করে পাঠাবে।
        </p>

        {suppliers.length === 0 ? (
          <p className="text-sm text-slate-500">
            কোনো active supplier নেই। Suppliers page থেকে তৈরি করুন।
          </p>
        ) : (
          <>
            <div className="space-y-2 mb-4">
              {suppliers
                .filter((s) => s.active)
                .map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelected(s.id)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border text-left transition ${
                      selected === s.id
                        ? "border-gold bg-amber-50"
                        : "border-slate-200 hover:border-slate-400"
                    }`}
                  >
                    <span className="text-sm text-slate-900 font-medium">
                      {s.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      cost ৳{(s.cost / 100).toLocaleString("en-BD")}
                    </span>
                  </button>
                ))}
            </div>
            <button
              onClick={forward}
              disabled={pending}
              className="w-full bg-gold text-ink font-semibold py-3 rounded-xl hover:brightness-110 transition disabled:opacity-50"
            >
              {pending ? "Forwarding…" : "📤 Forward Order"}
            </button>
          </>
        )}
        {msg && (
          <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2 mt-3">
            {msg}
          </p>
        )}
      </div>
    </div>
  );
}
