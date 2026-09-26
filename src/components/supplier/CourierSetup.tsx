"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { CourierProvider } from "@prisma/client";
import {
  saveCourierCredential,
  deleteCourierCredential,
} from "@/app/supplier/actions";

const PROVIDERS: CourierProvider[] = [
  "PATHAO",
  "REDX",
  "STEADFAST",
  "SUNDARBAN",
  "PAPERFLY",
  "OTHER",
];

type Cred = {
  provider: CourierProvider;
  apiKey: string;
  apiSecret: string;
  baseUrl: string;
};

export default function CourierSetup({ initial }: { initial: Cred[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");
  const [provider, setProvider] = useState<CourierProvider>(
    initial[0]?.provider ?? "PATHAO"
  );
  const existing = initial.find((c) => c.provider === provider);

  const [apiKey, setApiKey] = useState(existing?.apiKey ?? "");
  const [apiSecret, setApiSecret] = useState(existing?.apiSecret ?? "");
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl ?? "");

  // when provider changes, load that provider's saved values
  function selectProvider(p: CourierProvider) {
    setProvider(p);
    const c = initial.find((x) => x.provider === p);
    setApiKey(c?.apiKey ?? "");
    setApiSecret(c?.apiSecret ?? "");
    setBaseUrl(c?.baseUrl ?? "");
  }

  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";

  const save = () =>
    start(async () => {
      setMsg("");
      const res = await saveCourierCredential({
        provider,
        apiKey,
        apiSecret,
        baseUrl,
      });
      if (!res.ok) setMsg(res.error ?? "Failed");
      else {
        setMsg("Saved ✓");
        router.refresh();
        setTimeout(() => setMsg(""), 2500);
      }
    });

  const remove = () =>
    start(async () => {
      if (!confirm(`${provider} credential মুছে ফেলবেন?`)) return;
      await deleteCourierCredential(provider);
      setApiKey("");
      setApiSecret("");
      setBaseUrl("");
      router.refresh();
    });

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h2 className="text-slate-900 font-semibold mb-3">Providers</h2>
        <div className="space-y-1.5">
          {PROVIDERS.map((p) => {
            const has = initial.some((c) => c.provider === p);
            return (
              <button
                key={p}
                onClick={() => selectProvider(p)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm transition ${
                  provider === p
                    ? "bg-amber-50 text-amber-800 font-medium"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                {p}
                {has && (
                  <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full">
                    setup
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6">
        <h2 className="text-slate-900 font-semibold mb-1">{provider} Credentials</h2>
        <p className="text-xs text-slate-500 mb-5">
          আপনার dashboard থেকে API Key / Secret নিয়ে এখানে save করুন।
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              API Key / Client ID *
            </label>
            <input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className={inputCls}
              placeholder="your api key"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              API Secret
            </label>
            <input
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              className={inputCls}
              placeholder="your api secret"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Booking API URL (optional)
            </label>
            <input
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className={inputCls}
              placeholder="https://api.pathao.com/aladdin/api/v1/orders"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              দিলে order book করার সময় সরাসরি API call হবে। না দিলে manual tracking ID দিয়ে কাজ চলবে।
            </p>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={save}
              disabled={pending}
              className="bg-gold text-ink font-semibold px-6 py-2.5 rounded-lg hover:brightness-110 transition disabled:opacity-50"
            >
              {pending ? "Saving…" : "Save Credentials"}
            </button>
            {existing && (
              <button
                onClick={remove}
                disabled={pending}
                className="text-rose-600 text-sm px-4 py-2.5 rounded-lg hover:bg-rose-50 transition"
              >
                Remove
              </button>
            )}
            {msg && <span className="text-sm text-emerald-600">{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
