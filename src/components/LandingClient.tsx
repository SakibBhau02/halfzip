"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import type { PublicProduct } from "@/lib/product";
import Reveal from "@/components/Reveal";
import Quality from "@/components/Quality";
import { formatBDT } from "@/lib/utils";
import { comboSubtotal, comboDelivery, comboSavings } from "@/lib/combo";

/* --------------------------------- icons --------------------------------- */

function Star() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4 fill-gold" aria-hidden>
      <path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2z" />
    </svg>
  );
}
function WhatsappIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} fill-current`} aria-hidden>
      <path d="M17.5 14.4c-.3-.2-1.7-.9-2-1-.2-.1-.4-.1-.6.1s-.7.9-.8 1c-.1.2-.3.2-.5.1-1-.5-1.6-.9-2.3-2-.2-.3.2-.3.6-.9.1-.2 0-.4 0-.5s-.6-1.5-.9-2c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.4-.2.3-.9.9-.9 2.2s1 2.5 1.1 2.7c.1.2 1.9 3 4.7 4.2 1.7.7 2.3.8 3.1.6.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.5-.3zM12 2a10 10 0 00-8.5 15.2L2 22l4.9-1.4A10 10 0 1012 2zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-2.9.8.8-2.8-.2-.3A8.2 8.2 0 1112 20.2z" />
    </svg>
  );
}
const FALLBACK_WHATSAPP = "8801XXXXXXXXX";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    ttq?: { track: (...args: unknown[]) => void };
    gtag?: (...args: unknown[]) => void;
  }
}

function trackPurchase(orderNumber: string, total: number) {
  // NOTE (COD architecture): an order placed is NOT a purchase.
  // Browser fires intent only; the real Purchase fires server-side
  // when the courier confirms delivery (courier-truth conversions).
  try {
    window.gtag?.("event", "begin_checkout", {
      transaction_id: orderNumber,
      value: total / 100,
      currency: "BDT",
    });
    window.fbq?.("track", "InitiateCheckout", {
      value: total / 100,
      currency: "BDT",
    });
    window.ttq?.track("PlaceAnOrder", {
      value: total / 100,
      currency: "BDT",
    });
  } catch {
    /* analytics must never break the order flow */
  }
}

/* --------------------------- BD phone validation --------------------------- */

const BD_PHONE_RE = /^01[3-9]\d{8}$/;

/**
 * Normalize user-typed BD mobile numbers:
 * strips spaces/dashes, converts 8801XXXXXXXXX → 01XXXXXXXXX.
 * Returns "" when not a valid Bangladeshi mobile number.
 */
export function normalizeBdPhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("880") && d.length === 13) d = "0" + d.slice(3);
  if (d.startsWith("00880") && d.length === 15) d = "0" + d.slice(5);
  return BD_PHONE_RE.test(d) ? d : "";
}

/** Read ad click IDs from cookies/URL for server-side attribution. */
function getTrackingIds(): {  fbp: string;
  fbc: string;
  ttclid: string;
  gaClientId: string;
} {
  const out = { fbp: "", fbc: "", ttclid: "", gaClientId: "" };
  try {
    const cookies = Object.fromEntries(
      document.cookie.split(";").map((c) => {
        const i = c.indexOf("=");
        return [c.slice(0, i).trim(), decodeURIComponent(c.slice(i + 1).trim())];
      })
    );
    out.fbp = cookies._fbp ?? "";
    out.fbc = cookies._fbc ?? "";
    // TikTok click id: URL param wins, else _ttp cookie
    const params = new URLSearchParams(window.location.search);
    out.ttclid = params.get("ttclid") ?? cookies._ttp ?? "";
    // GA client id = last two parts of _ga cookie
    const ga = cookies._ga ?? "";
    const parts = ga.split(".");
    if (parts.length >= 2) out.gaClientId = parts.slice(-2).join(".");
  } catch {
    /* attribution must never break the order flow */
  }
  return out;
}

/* ------------------------------- order form ------------------------------- */

type Line = { colorIdx: number; size: string };

function OrderForm({
  product,
  activeColorIndex,
  whatsappNumber,
  onColorPick,
}: {
  product: PublicProduct;
  activeColorIndex: number;
  whatsappNumber: string;
  onColorPick: (i: number) => void;
}) {
  const colors = product.colors;
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [district, setDistrict] = useState("");
  const [zone, setZone] = useState<"inside" | "outside">("inside");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);

  // Initial color follows the gallery selection. Afterwards the form
  // follows gallery clicks ONLY while untouched (no size picked yet) —
  // in-progress selections are never wiped.
  const [lines, setLines] = useState<Line[]>([
    { colorIdx: activeColorIndex, size: "" },
  ]);
  const [focusIdx, setFocusIdx] = useState(0);
  const prevActive = useRef(activeColorIndex);

  useEffect(() => {
    if (prevActive.current === activeColorIndex) return;
    prevActive.current = activeColorIndex;
    setLines((prev) =>
      prev.length === 1 && !prev[0].size
        ? [{ colorIdx: activeColorIndex, size: "" }]
        : prev
    );
  }, [activeColorIndex]);

  const qty = lines.length;
  const cfg = {
    basePrice: product.basePrice,
    combo2Price: product.combo2Price,
    combo3Price: product.combo3Price,
    freeDeliveryAt: product.freeDeliveryAt,
    insideFee: product.insideFee,
    outsideFee: product.outsideFee,
  };
  const goods = comboSubtotal(cfg, qty);
  const delivery = comboDelivery(cfg, qty, zone);
  const total = goods + delivery;
  const savings = comboSavings(cfg, qty);

  const focusColor = colors[lines[focusIdx]?.colorIdx ?? 0];

  const setQty = (n: number) => {
    setLines((prev) => {
      if (n > prev.length) {
        const add = Array.from({ length: n - prev.length }, () => ({
          colorIdx: prev[0]?.colorIdx ?? 0,
          size: "",
        }));
        return [...prev, ...add];
      }
      return prev.slice(0, n);
    });
  };

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const submit = async () => {
    setError("");
    if (!name || !phone || !address) {
      setError("অনুগ্রহ করে নাম, ফোন ও ঠিকানা পূরণ করুন।");
      return;
    }
    // Bangladesh mobile only — normalize + strict check
    const cleanPhone = normalizeBdPhone(phone);
    if (!cleanPhone) {
      setError("সঠিক বাংলাদেশি মোবাইল নাম্বার দিন (01XXXXXXXXX, ১১ সংখ্যা)।");
      return;
    }
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].size) {
        setError(`Product ${i + 1} এর সাইজ নির্বাচন করুন।`);
        return;
      }
    }
    const items = lines.map((l) => {
      const c = colors[l.colorIdx];
      const v = c?.variants.find((x) => x.size === l.size);
      return { variantId: v?.id ?? "" };
    });
    if (items.some((i) => !i.variantId)) {
      setError("নির্বাচিত একটি configuration স্টকে নেই।");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: cleanPhone,
          address,
          district,
          zone,
          notes: "",
          items,
          ...getTrackingIds(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 24h duplicate → WhatsApp popup so they can order via chat
        if (data.code === "DUPLICATE_24H") {
          const dupMsg = encodeURIComponent(
            `আসসালামু আলাইকুম! আমি ${name} (${cleanPhone}) — ২৪ ঘণ্টার মধ্যে আরেকটি অর্ডার করতে চাই।\n\n${lines.map((l, i) => `${i + 1}. ${colors[l.colorIdx]?.name} / ${l.size}`).join("\n")}`
          );
          window.open(
            `https://wa.me/${(whatsappNumber || FALLBACK_WHATSAPP).replace(/\D/g, "")}?text=${dupMsg}`,
            "_blank"
          );
        }
        setError(data.error ?? "কিছু ভুল হয়েছে।");
        setLoading(false);
        return;
      }
      setDone(data.orderNumber);
      setLoading(false);
      trackPurchase(data.orderNumber, data.total);
      const summary = lines
        .map(
          (l, i) =>
            `${i + 1}. ${colors[l.colorIdx]?.name} / ${l.size}`
        )
        .join("\n");
      const msg = encodeURIComponent(
        `🛍️ অর্ডার — ${product.name}\nনাম: ${name}\nফোন: ${cleanPhone}\nঠিকানা: ${address}${district ? ", " + district : ""}\n\n${summary}\n\nঅর্ডার নম্বর: ${data.orderNumber}\nসর্বমোট: ${formatBDT(data.total)}`
      );
      window.open(
        `https://wa.me/${(whatsappNumber || FALLBACK_WHATSAPP).replace(/\D/g, "")}?text=${msg}`,
        "_blank"
      );
    } catch {
      setError("নেটওয়ার্ক সমস্যা। আবার চেষ্টা করুন।");
      setLoading(false);
    }
  };

  if (done) {
    return (
      <section id="order" className="bg-cream py-24 px-6 scroll-mt-16">
        <div className="max-w-lg mx-auto text-center bg-white rounded-2xl p-10 shadow-xl">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-5 text-3xl">
            ✓
          </div>
          <h2 className="font-display text-3xl mb-3">অর্ডার সফল হয়েছে!</h2>
          <p className="text-warmgray mb-2">
            আপনার অর্ডার নম্বর: <b className="text-ink">{done}</b>
          </p>
          <p className="text-warmgray text-sm mb-6">
            আমরা শীঘ্রই কল করে অর্ডার কনফার্ম করবো। WhatsApp-এও মেসেজ পাঠানো হয়েছে।
          </p>
          <a
            href={`/track?order=${encodeURIComponent(done)}`}
            className="block w-full bg-ink text-cream font-semibold py-3.5 rounded-xl hover:bg-gold hover:text-ink transition mb-3"
          >
            🔍 অর্ডার ট্র্যাক করুন
          </a>
          <button
            onClick={() => {
              setDone(null);
              setName("");
              setPhone("");
              setAddress("");
              setDistrict("");
              setLines([{ colorIdx: 0, size: "" }]);
            }}
            className="text-sm text-gold hover:underline"
          >
            আরেকটি অর্ডার করুন
          </button>
        </div>
      </section>
    );
  }

  return (
    <section id="order" className="bg-cream py-14 sm:py-20 px-4 sm:px-6 scroll-mt-16">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-10 sm:mb-12">
          <p className="uppercase tracking-[0.35em] text-xs text-gold mb-3">
            Cash on Delivery
          </p>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl mb-3">
            এখনই অর্ডার করুন
          </h2>
          <p className="text-warmgray max-w-xl mx-auto text-sm sm:text-base">
            কম্বো নিলে প্রতি পিসে সাশ্রয় — ৩ পিস নিলে ডেলিভারি সম্পূর্ণ ফ্রি।
          </p>
        </div>

        <div className="grid lg:grid-cols-[minmax(0,1fr)_1.15fr] gap-6 sm:gap-8 items-start">
          {/* LEFT — live preview */}
          <div className="lg:sticky lg:top-24 space-y-4">
            <div className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-white shadow-xl">
              {colors.map((c, i) => (
                <div
                  key={c.name}
                  className={`absolute inset-0 transition-opacity duration-500 ${
                    i === (lines[focusIdx]?.colorIdx ?? 0)
                      ? "opacity-100"
                      : "opacity-0"
                  }`}
                >
                  {c.image && (
                    <Image
                      src={c.image}
                      alt={`${c.name} ${product.name}`}
                      fill
                      sizes="(max-width: 1024px) 100vw, 45vw"
                      className="object-cover"
                    />
                  )}
                </div>
              ))}
              {focusColor && (
                <span className="absolute top-4 left-4 bg-ink/90 text-cream text-sm font-medium px-4 py-2 rounded-full z-10">
                  কালার: {focusColor.name}
                </span>
              )}
              {qty >= product.freeDeliveryAt && (
                <span className="absolute top-4 right-4 bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full z-10">
                  Free Delivery 🚚
                </span>
              )}
            </div>

            {/* quantity stepper */}
            <div className="bg-white rounded-xl border border-black/10 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-medium text-ink">কয়টি নেবেন?</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  disabled={qty <= 1}
                  aria-label="Decrease quantity"
                  className="w-9 h-9 rounded-full border border-black/15 text-lg font-bold text-ink hover:border-ink transition disabled:opacity-30"
                >
                  −
                </button>
                <span className="font-display text-2xl text-ink w-8 text-center">
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => setQty(Math.min(3, qty + 1))}
                  disabled={qty >= 3}
                  aria-label="Increase quantity"
                  className="w-9 h-9 rounded-full border border-black/15 text-lg font-bold text-ink hover:border-ink transition disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
            {qty >= product.freeDeliveryAt && (
              <p className="text-center text-sm text-emerald-600 font-medium">
                🎉 {qty}টি নিলে ডেলিভারি সম্পূর্ণ ফ্রি!
              </p>
            )}
          </div>

          {/* RIGHT — form */}
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
            {/* per-product config */}
            <div className="space-y-4">
              {lines.map((line, i) => {
                const lc = colors[line.colorIdx];
                return (
                  <div
                    key={i}
                    onMouseEnter={() => setFocusIdx(i)}
                    onClick={() => setFocusIdx(i)}
                    className={`rounded-xl border p-4 transition ${
                      focusIdx === i ? "border-gold/60 bg-gold/[0.03]" : "border-black/10"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-base font-bold text-ink">
                        {lines.length > 1 ? `Product ${i + 1}` : "আপনার পছন্দ"}
                      </p>
                      {lc && (
                        <span className="text-sm font-semibold text-gold">
                          🎨 {lc.name}
                        </span>
                      )}
                    </div>

                    {/* colors — big focus */}
                    <p className="text-xs font-medium text-warmgray mb-2">
                      কালার সিলেক্ট করুন *
                    </p>
                    <div className="flex flex-wrap gap-3 mb-4">
                      {colors.map((c, ci) => (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => {
                            updateLine(i, { colorIdx: ci, size: "" });
                            setFocusIdx(i);
                            onColorPick(ci);
                          }}
                          aria-label={c.name}
                          title={c.name}
                          className={`w-12 h-12 rounded-full border-[3px] transition ${
                            line.colorIdx === ci
                              ? "border-gold scale-110 ring-2 ring-gold/40"
                              : "border-black/10 hover:border-ink/50 hover:scale-105"
                          }`}
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>

                    {/* sizes — big focus */}
                    <p className="text-xs font-medium text-warmgray mb-2">
                      সাইজ সিলেক্ট করুন *
                    </p>
                    <div className="flex flex-wrap gap-2.5">
                      {product.sizes.map((s) => {
                        const inStock =
                          lc?.variants.find((v) => v.size === s)?.stock ?? 0;
                        return (
                          <button
                            key={s}
                            type="button"
                            disabled={inStock <= 0}
                            onClick={() => updateLine(i, { size: s })}
                            className={`min-w-[64px] px-4 py-3 rounded-xl border-2 text-base font-bold transition ${
                              line.size === s
                                ? "bg-ink text-cream border-ink"
                                : inStock <= 0
                                  ? "border-black/10 text-black/25 line-through cursor-not-allowed"
                                  : "border-black/15 hover:border-ink"
                            }`}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* contact */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">আপনার নাম *</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-black/10 px-4 py-3 outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
                  placeholder="রফিকুল ইসলাম"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  মোবাইল নাম্বার *
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  className="w-full rounded-lg border border-black/10 px-4 py-3 outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
                  placeholder="01XXXXXXXXX"
                />
                <p className="text-[11px] text-warmgray mt-1">
                  শুধু বাংলাদেশি মোবাইল নাম্বার (১১ সংখ্যা)
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                সম্পূর্ণ ঠিকানা *
              </label>
              <textarea
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-black/10 px-4 py-3 outline-none focus:border-gold focus:ring-2 focus:ring-gold/30 resize-none"
                placeholder="গ্রাম/এলাকা, থানা"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">জেলা</label>
                <input
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full rounded-lg border border-black/10 px-4 py-3 outline-none focus:border-gold focus:ring-2 focus:ring-gold/30"
                  placeholder="ঢাকা / চট্টগ্রাম"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  ডেলিভারি এলাকা
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { k: "inside", l: "ঢাকার ভিতরে" },
                    { k: "outside", l: "ঢাকার বাইরে" },
                  ].map((z) => (
                    <button
                      key={z.k}
                      type="button"
                      onClick={() => setZone(z.k as "inside" | "outside")}
                      className={`py-3 rounded-lg border text-xs font-medium transition ${
                        zone === z.k
                          ? "bg-ink text-cream border-ink"
                          : "border-black/15 hover:border-ink"
                      }`}
                    >
                      {z.l}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* totals */}
            <div className="border-t border-black/10 pt-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-warmgray">
                  {qty}pcs {qty > 1 ? "কম্বো" : ""} ({formatBDT(product.basePrice)} × {qty})
                </span>
                <span>{formatBDT(product.basePrice * qty)}</span>
              </div>
              {savings > 0 && (
                <div className="flex justify-between text-sm mb-1 text-emerald-600 font-medium">
                  <span>কম্বো ছাড়</span>
                  <span>- {formatBDT(savings)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm mb-3">
                <span className="text-warmgray">ডেলিভারি চার্জ</span>
                <span className={delivery === 0 ? "text-emerald-600 font-medium" : ""}>
                  {delivery === 0 ? "ফ্রি" : formatBDT(delivery)}
                </span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-medium">সর্বমোট</span>
                <span className="font-display text-3xl text-ink">
                  {formatBDT(total)}
                </span>
              </div>
            </div>

            {error && (
              <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              onClick={submit}
              disabled={loading}
              className="w-full bg-ink text-cream font-semibold py-4 rounded-xl hover:bg-gold transition text-lg disabled:opacity-60"
            >
              {loading ? "অর্ডার প্রসেস হচ্ছে…" : `Order Now — ${formatBDT(total)}`}
            </button>

            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1 text-xs text-warmgray">
              <span>✓ পণ্য হাতে পেয়ে টাকা</span>
              <span>✓ রিটার্ন / এক্সচেঞ্জ</span>
              <span>✓ দ্রুত ডেলিভারি</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
/* --------------------------------- hero ---------------------------------- */

function HeroSlider({
  product,
  manualIndex,
}: {
  product: PublicProduct;
  /** user-picked color locks the slider; null = auto-sliding showcase */
  manualIndex: number | null;
}) {
  const colors = product.colors;
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || colors.length <= 1) return;
    const t = setInterval(
      () => setSlide((s) => (s + 1) % colors.length),
      3000
    );
    return () => clearInterval(t);
  }, [paused, colors.length]);

  if (colors.length === 0) return null;

  const index = manualIndex ?? slide;
  const active = colors[index] ?? colors[0];

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative aspect-[4/5] rounded-3xl overflow-hidden shadow-2xl bg-white">
        {colors.map((c, i) => (
          <div
            key={c.name}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          >
            {c.image && (
              <Image
                src={c.image}
                alt={`${c.name} ${product.name}`}
                fill
                priority={i === 0}
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            )}
          </div>
        ))}

        {active && (
          <span className="absolute top-5 left-5 bg-ink/90 text-cream text-sm font-medium px-4 py-2 rounded-full z-10">
            কালার: {active.name}
          </span>
        )}
      </div>

      <div className="absolute -bottom-6 -left-6 bg-white rounded-2xl shadow-xl px-6 py-4 hidden sm:block">
        <p className="font-display text-2xl">{colors.length}</p>
        <p className="text-xs text-warmgray">কালার অপশন</p>
      </div>
    </div>
  );
}

/* --------------------------------- page ---------------------------------- */

export default function LandingClient({
  product,
  whatsappNumber,
}: {
  product: PublicProduct;
  whatsappNumber?: string;
}) {
  const [colorIndex, setColorIndex] = useState(0);
  // User-picked color locks the hero slider; null = auto-sliding showcase
  const [manualColor, setManualColor] = useState<number | null>(null);
  const pickColor = useCallback((i: number) => {
    setColorIndex(i);
    setManualColor(i);
  }, []);
  const scrollToOrder = useCallback(() => {
    document.getElementById("order")?.scrollIntoView({ behavior: "smooth" });
    window.location.hash = "order";
  }, []);

  const mainColor = product.colors[colorIndex];
  const discount =
    product.oldPrice > product.basePrice
      ? Math.round((1 - product.basePrice / product.oldPrice) * 100)
      : 0;

  const waNumber = (whatsappNumber || FALLBACK_WHATSAPP).replace(/\D/g, "");
  const waLink = `https://wa.me/${waNumber}?text=${encodeURIComponent(
    `আমি ${product.name} সম্পর্কে জানতে চাই।`
  )}`;

  return (
    <main className="pb-24">
      <div className="bg-ink text-cream text-xs uppercase tracking-widest overflow-hidden">
        <div className="flex whitespace-nowrap animate-marquee py-2.5">
          {[...Array(2)].map((_, i) => (
            <span key={i} className="flex">
              {[
                "Cash on Delivery all over Bangladesh",
                "Premium Winter Wear",
                "Free Size Exchange",
                "Order Now — Limited Stock",
              ].map((t) => (
                <span key={t} className="mx-8 flex items-center gap-3">
                  {t} <span className="text-gold">✦</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <header className="sticky top-0 z-40 backdrop-blur-md bg-cream/80 border-b border-black/5">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <span className="font-display text-xl tracking-tight">
            HALF<span className="text-gold">·</span>ZIPPER
          </span>
          <nav className="hidden md:flex gap-8 text-sm text-warmgray">
            <a href="#quality" className="hover:text-ink transition">কোয়ালিটি</a>
            <a href="#colors" className="hover:text-ink transition">কালার</a>
            <a href="#order" className="hover:text-ink transition">অর্ডার</a>
          </nav>
          <a
            href="#order"
            className="bg-ink text-cream text-sm px-5 py-2.5 rounded-full hover:bg-gold transition"
          >
            Order Now
          </a>        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-14 pb-16 sm:pb-20 grid lg:grid-cols-2 gap-10 sm:gap-12 items-center">
          <div className="animate-fade-up">
            <p className="uppercase tracking-[0.4em] text-xs text-gold mb-5">
              Winter Collection 2026
            </p>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl leading-[1.05] mb-6 text-balance">
              {product.name.split(" ").slice(0, 2).join(" ")}
              <br />
              <span className="italic text-warmgray">
                {product.name.split(" ").slice(2).join(" ")}
              </span>
            </h1>
            <p className="text-base sm:text-lg text-warmgray leading-relaxed mb-8 max-w-md">
              {product.description}
            </p>

            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mb-8">
              <span className="font-display text-4xl text-ink">
                {formatBDT(product.basePrice)}
              </span>
              {product.oldPrice > product.basePrice && (
                <>
                  <span className="text-warmgray line-through text-xl">
                    {formatBDT(product.oldPrice)}
                  </span>
                  <span className="bg-gold/15 text-gold text-xs font-semibold px-3 py-1 rounded-full">
                    {discount}% OFF
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="#order"
                className="bg-ink text-cream px-8 py-4 rounded-xl font-semibold hover:bg-gold transition"
              >
                Order Now
              </a>
              <a
                href="#quality"
                className="border border-ink/20 px-8 py-4 rounded-xl font-semibold hover:border-ink transition"
              >
                কোয়ালিটি দেখুন
              </a>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 mt-8 text-sm text-warmgray">
              <span>✓ COD available</span>
              <span>✓ {product.colors.length}টি কালার</span>
              <span>✓ {product.sizes.join(" · ")}</span>
            </div>
          </div>

          <div className="relative animate-fade-up" style={{ animationDelay: "0.15s" }}>
            <HeroSlider
              product={product}
              manualIndex={manualColor}
            />
          </div>
        </div>
      </section>

      <section className="bg-white border-y border-black/5">
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { t: "Cash on Delivery", d: "সারা দেশে" },
            { t: `${product.colors.length}টি কালার`, d: product.sizes.join(" · ") },
            { t: "প্রিমিয়াম ফ্যাব্রিক", d: "Cotton Fleece" },
            { t: "ইজি রিটার্ন", d: "পছন্দ না হলে" },
          ].map((f) => (
            <div key={f.t}>
              <p className="font-display text-lg">{f.t}</p>
              <p className="text-xs text-warmgray mt-1">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {product.colors.length > 0 && (
        <section id="colors" className="py-16 sm:py-24 px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <Reveal>
              <div className="text-center mb-14">
                <p className="uppercase tracking-[0.35em] text-xs text-gold mb-4">
                  Pick Your Shade
                </p>
                <h2 className="font-display text-4xl md:text-5xl">
                  আপনার পছন্দের কালার
                </h2>
              </div>
            </Reveal>
            <Reveal delay={100}>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {product.colors.map((c, i) => (
                  <button
                    key={c.name}
                    onClick={() => {
                      pickColor(i);
                      scrollToOrder();
                    }}
                    className="group text-left"
                  >
                    <div className="relative aspect-[3/4] rounded-xl overflow-hidden bg-white shadow-sm group-hover:shadow-xl transition">
                      {c.image && (
                        <Image
                          src={c.image}
                          alt={`${c.name} ${product.name}`}
                          fill
                          sizes="20vw"
                          className="object-cover group-hover:scale-105 transition duration-500"
                        />
                      )}
                      {colorIndex === i && (
                        <span className="absolute inset-0 ring-2 ring-gold rounded-xl" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/10"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className="text-sm">{c.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </Reveal>
          </div>
        </section>
      )}

      <Quality />

      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <Reveal>
            <div className="text-center mb-12">
              <p className="uppercase tracking-[0.35em] text-xs text-gold mb-4">
                Size Guide
              </p>
              <h2 className="font-display text-4xl md:text-5xl">সাইজ গাইড</h2>
            </div>
          </Reveal>
          <Reveal delay={100}>
            <div className="overflow-x-auto rounded-2xl border border-black/10 bg-white">
              <table className="w-full text-sm min-w-[520px]">
                <thead className="bg-ink text-cream">
                  <tr>
                    {["সাইজ", "চেস্ট (ইঞ্চি)", "লম্বা (ইঞ্চি)", "উপযোগী"].map((h) => (
                      <th key={h} className="px-4 py-4 text-left font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5">
                  {[
                    ["M", "38", "26", "50–58 kg"],
                    ["L", "40", "27", "58–67 kg"],
                    ["XL", "42", "28", "67–76 kg"],
                    ["XXL", "44", "29", "76–85 kg"],
                  ].map((r) => (
                    <tr key={r[0]} className="hover:bg-cream/60 transition">
                      {r.map((cell, i) => (
                        <td
                          key={i}
                          className={`px-4 py-4 ${i === 0 ? "font-display text-lg" : "text-warmgray"}`}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      <OrderForm
        product={product}
        activeColorIndex={colorIndex}
        whatsappNumber={whatsappNumber ?? FALLBACK_WHATSAPP}
        onColorPick={pickColor}
      />

      <section className="bg-ink text-cream py-14 sm:py-20 px-4 sm:px-6 text-center">
        <h2 className="font-display text-4xl md:text-5xl mb-4">
          শীত শেষ হওয়ার আগেই নিয়ে নিন
        </h2>
        <p className="text-warmgray mb-8 max-w-xl mx-auto">
          সীমিত স্টক। আজই অর্ডার করুন — পণ্য হাতে পেয়ে টাকা দিন।
        </p>
        <a
          href="#order"
          className="bg-gold text-ink px-10 py-4 rounded-xl font-semibold hover:brightness-110 transition"
        >
          Order Now — {formatBDT(product.basePrice)}
        </a>
      </section>

      <footer className="bg-cream px-4 sm:px-6 py-10 text-center text-sm text-warmgray pb-24">
        <p className="font-display text-lg text-ink mb-2">
          HALF<span className="text-gold">·</span>ZIPPER
        </p>
        <p>Premium Winter Wear · Bangladesh</p>
        <a
          href="/track"
          className="inline-block mt-5 bg-ink text-cream text-sm font-semibold px-8 py-3 rounded-xl hover:bg-gold hover:text-ink transition"
        >
          🔍 অর্ডার ট্র্যাক
        </a>
        <p className="mt-6 text-xs opacity-70">
          © {new Date().getFullYear()} Half Zipper. All rights reserved.
        </p>
      </footer>

      <a
        href={waLink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat on WhatsApp"
        className="fixed bottom-24 right-4 sm:right-5 z-50 w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#25D366] text-white flex items-center justify-center shadow-2xl hover:scale-105 transition animate-pulse-ring"
      >
        <WhatsappIcon className="w-7 h-7" />
      </a>

      <div className="fixed bottom-0 left-0 right-0 z-40 bg-ink/95 backdrop-blur text-cream border-t border-white/10">
        <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between gap-3">
          <div className="leading-tight shrink-0">
            <p className="font-display text-base sm:text-lg">
              {formatBDT(product.basePrice)}
            </p>
            <p className="text-[10px] sm:text-[11px] text-warmgray">
              {mainColor ? mainColor.name + " · " : ""}Cash on Delivery
            </p>
          </div>
          <a
            href="#order"
            className="flex-1 sm:flex-none text-center bg-gold text-ink font-semibold px-5 sm:px-8 py-3 rounded-xl hover:brightness-110 transition text-sm sm:text-base"
          >
            Order Now
          </a>
        </div>
      </div>
    </main>
  );
}
