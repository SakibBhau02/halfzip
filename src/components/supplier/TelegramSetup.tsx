"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMyTelegram } from "@/app/supplier/actions";

/**
 * Supplier connects Telegram to receive forward + payment notifications.
 * Steps for the supplier: message the bot first, get the chat ID, save here.
 */
export default function TelegramSetup({
  current,
}: {
  current: string | null;
}) {
  const router = useRouter();
  const [chatId, setChatId] = useState(current ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  const save = () =>
    start(async () => {
      setMsg("");
      const res = await saveMyTelegram(chatId);
      setMsg(res.ok ? (res.message ?? "Saved ✓") : (res.error ?? "Failed"));
      if (res.ok) router.refresh();
      setTimeout(() => setMsg(""), 5000);
    });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-slate-900 font-semibold">🔔 Telegram Alerts</h2>
        {current ? (
          <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-emerald-50 text-emerald-600">
            Connected ✓
          </span>
        ) : (
          <span className="text-[11px] font-medium px-2 py-1 rounded-full bg-slate-100 text-slate-500">
            Not connected
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 mb-3">
        নতুন forward ও টাকা চাওয়ার notification Telegram-এ পাবেন।
      </p>
      <ol className="text-xs text-slate-600 space-y-1 mb-3 list-decimal list-inside">
        <li>আমাদের Telegram bot-কে Hi পাঠান</li>
        <li>
          <span className="font-mono">@userinfobot</span>-কে message করে আপনার{" "}
          <b>Chat ID</b> নিন
        </li>
        <li>নিচে বসিয়ে Connect চাপুন — টেস্ট মেসেজ আসবে</li>
      </ol>
      <div className="flex gap-2">
        <input
          value={chatId}
          onChange={(e) => setChatId(e.target.value)}
          placeholder="Chat ID (যেমন 123456789)"
          inputMode="numeric"
          className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400"
        />
        <button
          onClick={save}
          disabled={pending}
          className="bg-slate-900 text-white text-sm font-medium px-5 rounded-lg hover:bg-slate-700 transition disabled:opacity-50"
        >
          {pending ? "…" : "Connect"}
        </button>
      </div>
      {msg && (
        <p className="text-xs text-slate-700 bg-slate-100 rounded-lg px-3 py-2 mt-3">
          {msg}
        </p>
      )}
    </div>
  );
}
