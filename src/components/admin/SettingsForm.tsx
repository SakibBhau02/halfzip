"use client";

import { useState, useTransition } from "react";
import type { SettingsMap } from "@/lib/settings";
import { saveAllSettings, testTelegram } from "@/app/admin/(dashboard)/settings/actions";

function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <h3 className="text-slate-900 font-semibold">{title}</h3>
      {desc && <p className="text-xs text-slate-600 mt-0.5 mb-4">{desc}</p>}
      <div className="space-y-4 mt-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20"
      />
      {hint && <p className="text-xs text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

export default function SettingsForm({ initial }: { initial: SettingsMap }) {
  const [s, setS] = useState<SettingsMap>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [tgMsg, setTgMsg] = useState("");
  const [testing, setTesting] = useState(false);

  const set = (k: string) => (v: string) => setS({ ...s, [k]: v });

  const save = () =>
    start(async () => {
      const res = await saveAllSettings(s);
      setMsg(res.ok ? "Saved ✓" : res.error ?? "Failed");
      setTimeout(() => setMsg(""), 2500);
    });

  const test = async () => {
    setTesting(true);
    setTgMsg("");
    // Save first so the test uses latest values
    await saveAllSettings(s);
    const res = await testTelegram();
    setTgMsg(res.ok ? "✅ টেস্ট মেসেজ পাঠানো হয়েছে!" : res.error ?? "Failed");
    setTesting(false);
  };

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Telegram */}
        <Card
          title="Telegram Notification"
          desc="নতুন অর্ডার হলে সরাসরি আপনার টেলিগ্রামে মেসেজ যাবে।"
        >
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={s.telegram_enabled === "true"}
              onChange={(e) =>
                setS({ ...s, telegram_enabled: e.target.checked ? "true" : "false" })
              }
              className="w-4 h-4 accent-[#c8a24a]"
            />
            Enable Telegram notifications
          </label>
          <Field
            label="Bot Token"
            hint="@BotFather থেকে বট তৈরি করে টোকেন কপি করুন"
            value={s.telegram_bot_token}
            onChange={set("telegram_bot_token")}
            placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
          />
          <Field
            label="Chat ID"
            hint="আপনার টেলিগ্রাম user/group/channel ID (যেমন 123456789 বা -1001234567890)"
            value={s.telegram_chat_id}
            onChange={set("telegram_chat_id")}
            placeholder="123456789"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={test}
              disabled={testing}
              className="bg-slate-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
            >
              {testing ? "Testing…" : "Send test message"}
            </button>
            {tgMsg && <span className="text-sm text-slate-600">{tgMsg}</span>}
          </div>
        </Card>

        {/* WhatsApp */}
        <Card
          title="WhatsApp"
          desc="Landing page-এর floating WhatsApp button ও অর্ডার কনফার্মেশনে ব্যবহৃত হয়।"
        >
          <Field
            label="WhatsApp Number"
            hint="International format without + (যেমন 8801712345678)"
            value={s.whatsapp_number}
            onChange={set("whatsapp_number")}
            placeholder="8801712345678"
          />
        </Card>
      </div>

      {/* Analytics */}
      <Card
        title="Analytics & Tracking"
        desc="শুধু ID বসান — স্ক্রিপ্ট স্বয়ংক্রিয়ভাবে landing page-এ inject হবে। খালি রাখলে কিছু লোড হবে না।"
      >
        <div className="grid md:grid-cols-2 gap-4">
          <Field
            label="Google Analytics 4 (GA4)"
            hint="Measurement ID — G-XXXXXXXXXX"
            value={s.ga4_id}
            onChange={set("ga4_id")}
            placeholder="G-XXXXXXXXXX"
          />
          <Field
            label="Google Tag Manager (GTM)"
            hint="Container ID — GTM-XXXXXXX"
            value={s.gtm_id}
            onChange={set("gtm_id")}
            placeholder="GTM-XXXXXXX"
          />
          <Field
            label="Meta (Facebook) Pixel"
            hint="Pixel ID — 15-16 digit number"
            value={s.meta_pixel_id}
            onChange={set("meta_pixel_id")}
            placeholder="123456789012345"
          />
          <Field
            label="TikTok Pixel"
            hint="Pixel ID"
            value={s.tiktok_pixel_id}
            onChange={set("tiktok_pixel_id")}
            placeholder="CXXXXXXXXXXXXXXXXXXX"
          />
          <Field
            label="Google Ads"
            hint="Conversion ID — AW-XXXXXXXXX"
            value={s.google_ads_id}
            onChange={set("google_ads_id")}
            placeholder="AW-XXXXXXXXX"
          />
        </div>
      </Card>

      {/* Store / Invoice */}
      <Card
        title="Store & Invoice Details"
        desc="Invoice ও packing slip-এ এই তথ্য দেখানো হবে।"
      >
        <div className="grid md:grid-cols-2 gap-4">
          <Field
            label="Store Name"
            value={s.store_name}
            onChange={set("store_name")}
            placeholder="Half Zipper"
          />
          <Field
            label="Store Phone"
            value={s.store_phone}
            onChange={set("store_phone")}
            placeholder="01XXXXXXXXX"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Store Address
          </label>
          <textarea
            value={s.store_address}
            onChange={(e) => setS({ ...s, store_address: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20 resize-none"
            placeholder="Shop address, city"
          />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Field
            label="Store Email"
            value={s.store_email}
            onChange={set("store_email")}
            placeholder="hello@example.com"
          />
          <Field
            label="BIN / TIN"
            hint="VAT/BIN number (থাকলে)"
            value={s.store_bin}
            onChange={set("store_bin")}
            placeholder="0000000000000"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={s.store_vat_registered === "true"}
            onChange={(e) =>
              setS({ ...s, store_vat_registered: e.target.checked ? "true" : "false" })
            }
            className="w-4 h-4 accent-[#c8a24a]"
          />
          VAT Registered (invoice-এ Tax Invoice দেখাবে)
        </label>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Invoice Footer Note
          </label>
          <textarea
            value={s.invoice_footer}
            onChange={(e) => setS({ ...s, invoice_footer: e.target.value })}
            rows={2}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-gold focus:bg-white focus:ring-2 focus:ring-gold/20 resize-none"
          />
        </div>
      </Card>

      <div className="sticky bottom-0 bg-gradient-to-t from-slate-100 to-transparent pt-4 pb-2 flex items-center gap-3">
        <button
          onClick={save}
          disabled={pending}
          className="bg-gold text-ink font-semibold px-8 py-3 rounded-xl hover:brightness-110 transition disabled:opacity-60 shadow-sm"
        >
          {pending ? "Saving…" : "Save Settings"}
        </button>
        {msg && <span className="text-sm text-emerald-600 font-medium">{msg}</span>}
      </div>
    </div>
  );
}
