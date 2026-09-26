"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { OrderStatus } from "@prisma/client";
import { createOrder, type OrderFormInput } from "@/app/admin/(dashboard)/orders/actions";
import { formatBDT } from "@/lib/utils";

export type VariantOption = {
  id: string;
  sku: string;
  price: number;
  stock: number;
  color: string;
  colorHex: string;
  size: string;
};

type Line = { variantId: string; size: string; color: string };

export default function ManualOrderForm({
  variants,
  insideFee,
  outsideFee,
  combo2Price,
  combo3Price,
  freeDeliveryAt,
  basePrice,
  colors,
  sizes,
}: {
  variants: VariantOption[];
  insideFee: number;
  outsideFee: number;
  combo2Price: number;
  combo3Price: number;
  freeDeliveryAt: number;
  basePrice: number;
  colors: { name: string; hex: string }[];
  sizes: string[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [notes, setNotes] = useState("");
  const [zone, setZone] = useState<"inside" | "outside">("inside");
  const [lines, setLines] = useState<Line[]>([
    { variantId: variants[0]?.id ?? "", size: "", color: colors[0]?.name ?? "" },
  ]);
  const [status, setStatus] = useState<OrderStatus>("CONFIRMED");
  const [paymentMethod, setPaymentMethod] = useState<OrderFormInput["paymentMethod"]>("COD");
  const [paymentStatus, setPaymentStatus] = useState<OrderFormInput["paymentStatus"]>("UNPAID");
  const [error, setError] = useState("");

  const qty = lines.length;
  const goods =
    qty <= 1 ? basePrice : qty === 2 ? combo2Price : qty === 3 ? combo3Price : basePrice * qty;
  const delivery = qty >= freeDeliveryAt ? 0 : zone === "inside" ? insideFee : outsideFee;
  const savings = basePrice * qty - goods;
  const total = goods + delivery;

  const setQty = (n: number) =>
    setLines((prev) => {
      if (n > prev.length) {
        const add = Array.from({ length: n - prev.length }, () => ({
          variantId: "",
          size: "",
          color: colors[0]?.name ?? "",
        }));
        return [...prev, ...add];
      }
      return prev.slice(0, n);
    });

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const resolveVariant = (l: Line) =>
    variants.find((v) => v.color === l.color && v.size === l.size);

  const submit = () =>
    start(async () => {
      setError("");
      for (let i = 0; i < lines.length; i++) {
        if (!resolveVariant(lines[i])) {
          setError(`Product ${i + 1}: color ও size নির্বাচন করুন (stock সহ)।`);
          return;
        }
      }
      const res = await createOrder({
        customerName: name,
        phone,
        address,
        district,
        notes,
        zone,
        variantId: resolveVariant(lines[0])!.id,
        quantity: qty,
        status,
        paymentMethod,
        paymentStatus,
        extraVariantIds: lines.slice(1).map((l) => resolveVariant(l)!.id),
      });
      if (!res.ok) {
        setError(res.error ?? "Failed");
        return;
      }
      router.push(`/admin/orders/${res.id}`);
      router.refresh();
    });

  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* products */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-900 font-semibold">Products</h3>
            <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  onClick={() => setQty(n)}
                  className={`text-xs px-3 py-1.5 rounded-md transition font-medium ${
                    qty === n ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                  }`}
                >
                  {n}pc
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {lines.map((line, i) => {
              const lc = colors.find((c) => c.name === line.color);
              return (
                <div key={i} className="rounded-xl border border-slate-200 p-4">
                  <p className="text-sm font-semibold text-slate-900 mb-3">
                    Product {i + 1}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {colors.map((c) => (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => updateLine(i, { color: c.name, size: "" })}
                        aria-label={c.name}
                        className={`w-8 h-8 rounded-full border-2 transition ${
                          line.color === c.name ? "border-slate-900 scale-110" : "border-slate-200"
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((s) => {
                      const v = variants.find((x) => x.color === line.color && x.size === s);
                      const inStock = v?.stock ?? 0;
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={inStock <= 0}
                          onClick={() => updateLine(i, { size: s })}
                          className={`min-w-[48px] px-3 py-2 rounded-lg border text-sm font-medium transition ${
                            line.size === s
                              ? "bg-slate-900 text-white border-slate-900"
                              : inStock <= 0
                                ? "border-slate-100 text-slate-300 line-through cursor-not-allowed"
                                : "border-slate-200 text-slate-700 hover:border-slate-400"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                  {(() => {
                    const v = resolveVariant(line);
                    return v ? (
                      <p className="text-xs text-slate-500 mt-3 font-mono">
                        SKU: {v.sku} · Stock: {v.stock}
                      </p>
                    ) : null;
                  })()}
                </div>
              );
            })}
          </div>
        </div>

        {/* customer */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-slate-900 font-semibold mb-4">Customer Info</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Customer Name *
              </label>
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="রফিকুল ইসলাম" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Phone *
              </label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} placeholder="01XXXXXXXXX" />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Address *
            </label>
            <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="গ্রাম/এলাকা, থানা" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                District
              </label>
              <input value={district} onChange={(e) => setDistrict(e.target.value)} className={inputCls} placeholder="ঢাকা" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Delivery Zone
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { k: "inside", l: "Inside", p: insideFee },
                  { k: "outside", l: "Outside", p: outsideFee },
                ].map((z) => (
                  <button
                    key={z.k}
                    type="button"
                    onClick={() => setZone(z.k as "inside" | "outside")}
                    className={`py-2.5 rounded-lg border text-xs font-medium transition ${
                      zone === z.k
                        ? "bg-slate-900 text-white border-slate-900"
                        : "border-slate-200 text-slate-600 hover:border-slate-400"
                    }`}
                  >
                    {z.l} · {formatBDT(z.p)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* payment */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-slate-900 font-semibold mb-4">Payment & Notes</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Method</label>
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as OrderFormInput["paymentMethod"])} className={inputCls}>
                {["COD", "BKASH", "NAGAD", "ROCKET", "BANK_TRANSFER"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment</label>
              <select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as OrderFormInput["paymentStatus"])} className={inputCls}>
                {["UNPAID", "PAID", "REFUNDED"].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Status</label>
              <select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)} className={inputCls}>
                {(["NEW", "CONFIRMED", "PROCESSING", "SHIPPED", "DELIVERED"] as OrderStatus[]).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Internal Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} placeholder="অর্ডার সম্পর্কে নোট…" />
          </div>
        </div>
      </div>

      {/* summary */}
      <div>
        <div className="lg:sticky lg:top-8 bg-white border border-slate-200 rounded-2xl p-6">
          <h3 className="text-slate-900 font-semibold mb-4">Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>{qty}pcs ({formatBDT(basePrice)} × {qty})</span>
              <span className="text-slate-900">{formatBDT(basePrice * qty)}</span>
            </div>
            {savings > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>Combo discount</span>
                <span>- {formatBDT(savings)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>Delivery</span>
              <span className={delivery === 0 ? "text-emerald-600 font-medium" : "text-slate-900"}>
                {delivery === 0 ? "Free" : formatBDT(delivery)}
              </span>
            </div>
            <div className="flex justify-between items-baseline pt-3 border-t border-slate-100">
              <span className="text-slate-700 font-medium">Total</span>
              <span className="font-display text-2xl text-slate-900">{formatBDT(total)}</span>
            </div>
          </div>

          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2 mt-4">{error}</p>
          )}

          <button
            onClick={submit}
            disabled={pending}
            className="w-full mt-5 bg-amber-400 text-slate-900 font-semibold py-3.5 rounded-xl hover:bg-amber-300 transition disabled:opacity-60"
          >
            {pending ? "Creating…" : "Create Order"}
          </button>
          <p className="text-xs text-slate-500 mt-3 text-center">
            Telegram notification পাঠানো হবে।
          </p>
        </div>
      </div>
    </div>
  );
}
