"use client";

import { useState } from "react";
import Link from "next/link";

const STEPS = [
  { key: "NEW", bn: "অর্ডার পেয়েছি", desc: "আপনার অর্ডারটি আমাদের কাছে এসেছে" },
  { key: "CONFIRMED", bn: "কনফার্ম হয়েছে", desc: "ফোনে কনফার্ম করা হয়েছে" },
  { key: "PROCESSING", bn: "প্যাকিং চলছে", desc: "প্রোডাক্ট রেডি করা হচ্ছে" },
  { key: "SHIPPED", bn: "কুরিয়ারে দিয়েছি", desc: "পার্সেল কুরিয়ারের কাছে" },
  { key: "DELIVERED", bn: "ডেলিভারড ✓", desc: "আপনার হাতে পৌঁছেছে" },
] as const;

const TERMINAL_BN: Record<string, { bn: string; desc: string }> = {
  RETURNED: { bn: "রিটার্ন হয়েছে", desc: "পার্সেলটি ফেরত এসেছে" },
  CANCELLED: { bn: "বাতিল হয়েছে", desc: "অর্ডারটি বাতিল করা হয়েছে" },
};

type OrderSummary = {
  orderNumber: string;
  status: string;
  total: number;
  courierName: string | null;
  trackingId: string | null;
  createdAt: string;
  itemSummary: string;
};

type TrackData = {
  orderNumber: string;
  status: string;
  total: number;
  deliveryFee: number;
  advancePaid: number;
  paymentStatus: string;
  courierName: string | null;
  trackingId: string | null;
  trackingUrl: string | null;
  createdAt: string;
  items: { productName: string; variantLabel: string; quantity: number }[];
  timeline: { from: string | null; to: string; note: string | null; at: string }[];
};

const fmt = (minor: number) =>
  "৳" + (minor / 100).toLocaleString("en-BD", { maximumFractionDigits: 0 });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

export default function TrackClient({ initialOrder }: { initialOrder: string }) {
  const [orderNumber, setOrderNumber] = useState(initialOrder);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<TrackData | null>(null);
  const [list, setList] = useState<OrderSummary[] | null>(null);

  const fetchDetail = async (ord: string, ph: string) => {
    const res = await fetch(
      `/api/track?orderNumber=${encodeURIComponent(ord)}&phone=${encodeURIComponent(ph)}`,
      { cache: "no-store" }
    );
    const j = await res.json();
    if (!res.ok) throw new Error(j.error ?? "কিছু ভুল হয়েছে।");
    return j as TrackData;
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError("");
    setData(null);
    setList(null);
    if (!phone.trim()) {
      setError("মোবাইল নাম্বার দিন।");
      return;
    }
    setLoading(true);
    try {
      // Order number থাকলে সরাসরি detail, না থাকলে শুধু ফোনে list
      if (orderNumber.trim()) {
        setData(await fetchDetail(orderNumber.trim(), phone.trim()));
      } else {
        const res = await fetch(
          `/api/track?phone=${encodeURIComponent(phone.trim())}`,
          { cache: "no-store" }
        );
        const j = await res.json();
        if (!res.ok) setError(j.error ?? "কিছু ভুল হয়েছে।");
        else if (j.orders.length === 1) {
          setData(await fetchDetail(j.orders[0].orderNumber, phone.trim()));
        } else {
          setList(j.orders);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।"
      );
    } finally {
      setLoading(false);
    }
  };

  const pick = async (ord: string) => {
    setError("");
    setLoading(true);
    try {
      setData(await fetchDetail(ord, phone));
      setList(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "কিছু ভুল হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  const stepIdx = STEPS.findIndex((s) => s.key === data?.status);
  const terminal = data ? TERMINAL_BN[data.status] : null;

  return (
    <main className="min-h-screen bg-cream">
      {/* header */}
      <header className="bg-ink text-cream">
        <div className="max-w-2xl mx-auto px-4 py-5 flex items-center justify-between">
          <Link href="/" className="font-display text-xl tracking-tight">
            Half <span className="text-gold">Zipper</span>
          </Link>
          <Link href="/" className="text-sm text-cream/70 hover:text-gold transition">
            ← হোম
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="text-center mb-8">
          <p className="uppercase tracking-[0.35em] text-xs text-gold mb-3">
            Order Tracking
          </p>
          <h1 className="font-display text-3xl sm:text-4xl text-ink">
            আপনার পার্সেল কোথায়?
          </h1>
          <p className="text-warmgray text-sm mt-2">
            অর্ডারের সময় দেওয়া মোবাইল নাম্বার দিয়ে স্ট্যাটাস দেখুন
          </p>
        </div>

        {/* lookup form */}
        <form
          onSubmit={submit}
          className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              মোবাইল নাম্বার <span className="text-gold">*</span>
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
              inputMode="tel"
              className="w-full rounded-xl border border-ink/15 bg-cream/50 px-4 py-3 text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">
              অর্ডার নম্বর <span className="text-warmgray font-normal">(থাকলে দিন — না থাকলে খালি রাখুন)</span>
            </label>
            <input
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              placeholder="যেমন: HZ-20260926-0001"
              className="w-full rounded-xl border border-ink/15 bg-cream/50 px-4 py-3 font-mono text-ink outline-none focus:border-gold focus:ring-2 focus:ring-gold/20"
            />
          </div>
          {error && (
            <p className="text-sm text-rose-600 bg-rose-50 rounded-xl px-4 py-3">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-cream font-semibold py-3.5 rounded-xl hover:bg-gold hover:text-ink transition disabled:opacity-50"
          >
            {loading ? "খুঁজছি…" : "🔍 ট্র্যাক করুন"}
          </button>
        </form>

        {/* order list (phone-only lookup) */}
        {list && (
          <div className="mt-6 bg-white rounded-2xl shadow-xl p-6 animate-fade-up">
            <h2 className="font-semibold text-ink mb-1">
              আপনার অর্ডার ({list.length}টি)
            </h2>
            <p className="text-xs text-warmgray mb-4">
              বিস্তারিত দেখতে অর্ডারে ক্লিক করুন
            </p>
            <div className="divide-y divide-ink/5">
              {list.map((o) => (
                <button
                  key={o.orderNumber}
                  onClick={() => pick(o.orderNumber)}
                  className="w-full text-left py-3.5 flex items-center justify-between gap-3 hover:bg-cream/60 rounded-xl px-3 transition"
                >
                  <div className="min-w-0">
                    <p className="font-mono font-bold text-ink text-sm">
                      {o.orderNumber}
                    </p>
                    <p className="text-xs text-warmgray truncate mt-0.5">
                      {o.itemSummary}
                    </p>
                    <p className="text-[11px] text-warmgray mt-0.5">
                      {fmtDate(o.createdAt)} · {fmt(o.total)}
                      {o.trackingId ? ` · ${o.trackingId}` : ""}
                    </p>
                  </div>
                  <span className="text-xs font-medium bg-gold/15 text-ink px-2.5 py-1 rounded-full whitespace-nowrap">
                    {STEPS.find((s) => s.key === o.status)?.bn ??
                      TERMINAL_BN[o.status]?.bn ??
                      o.status}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* result */}
        {data && (
          <div className="mt-6 space-y-5 animate-fade-up">
            {/* status card */}
            <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                <div>
                  <p className="text-xs text-warmgray">অর্ডার</p>
                  <p className="font-mono font-bold text-lg text-ink">
                    {data.orderNumber}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-warmgray">সর্বমোট (COD)</p>
                  <p className="font-display text-2xl text-ink">{fmt(data.total)}</p>
                  {data.advancePaid > 0 && (
                    <p className="text-xs text-emerald-600">
                      অগ্রিম {fmt(data.advancePaid)} দেওয়া ✓
                    </p>
                  )}
                </div>
              </div>

              {terminal ? (
                <div className="rounded-xl bg-slate-100 px-5 py-4 text-center">
                  <p className="font-display text-2xl text-ink">{terminal.bn}</p>
                  <p className="text-sm text-warmgray mt-1">{terminal.desc}</p>
                  <p className="text-xs text-warmgray mt-2">
                    সাহায্য লাগলে আমাদের WhatsApp-এ মেসেজ করুন।
                  </p>
                </div>
              ) : (
                <ol className="space-y-0">
                  {STEPS.map((s, i) => {
                    const done = i <= stepIdx;
                    const current = i === stepIdx;
                    return (
                      <li key={s.key} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                              done
                                ? "bg-gold text-ink"
                                : "bg-ink/10 text-warmgray"
                            } ${current ? "ring-4 ring-gold/30" : ""}`}
                          >
                            {done ? "✓" : i + 1}
                          </span>
                          {i < STEPS.length - 1 && (
                            <span
                              className={`w-0.5 h-8 rounded ${done && i < stepIdx ? "bg-gold" : "bg-ink/10"}`}
                            />
                          )}
                        </div>
                        <div className={`pb-6 ${done ? "" : "opacity-50"}`}>
                          <p className="font-semibold text-ink">
                            {s.bn}
                            {current && (
                              <span className="ml-2 text-[11px] font-medium bg-gold/20 text-ink px-2 py-0.5 rounded-full">
                                এখন এখানে
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-warmgray mt-0.5">{s.desc}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}

              {/* courier box */}
              {(data.courierName || data.trackingId) && (
                <div className="mt-2 rounded-xl bg-cream border border-gold/30 px-5 py-4">
                  <p className="text-xs uppercase tracking-widest text-gold mb-2">
                    Courier Info
                  </p>
                  {data.courierName && (
                    <p className="text-sm text-ink">
                      <span className="text-warmgray">কুরিয়ার:</span>{" "}
                      <b>{data.courierName}</b>
                    </p>
                  )}
                  {data.trackingId && (
                    <p className="text-sm text-ink mt-1">
                      <span className="text-warmgray">ট্র্যাকিং ID:</span>{" "}
                      <b className="font-mono">{data.trackingId}</b>
                    </p>
                  )}
                  {data.trackingUrl && (
                    <a
                      href={data.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block mt-2 text-sm text-gold hover:underline"
                    >
                      কুরিয়ার সাইটে ট্র্যাক করুন →
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* items */}
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="font-semibold text-ink mb-3">
                আপনার আইটেম ({data.items.length})
              </h2>
              <div className="divide-y divide-ink/5">
                {data.items.map((it, i) => (
                  <div key={i} className="py-2.5 flex justify-between text-sm">
                    <span className="text-ink">
                      {it.productName}{" "}
                      <span className="text-warmgray">· {it.variantLabel}</span>
                    </span>
                    <span className="text-warmgray">× {it.quantity}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => {
                setData(null);
                setList(null);
                setPhone("");
              }}
              className="w-full text-sm text-warmgray hover:text-ink transition py-2"
            >
              অন্য অর্ডার ট্র্যাক করুন
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
