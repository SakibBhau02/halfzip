"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncOrderCourierStatus } from "@/app/admin/(dashboard)/orders/actions";
import { syncCourierStatus } from "@/app/supplier/actions";

/** "🔄 Sync courier status" button — works in both admin and supplier panels. */
export default function CourierSyncButton({
  orderId,
  variant,
}: {
  orderId: string;
  variant: "admin" | "supplier";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  const sync = () =>
    start(async () => {
      setMsg("");
      const res =
        variant === "admin"
          ? await syncOrderCourierStatus(orderId)
          : await syncCourierStatus(orderId);
      setMsg(res.ok ? (res.message ?? "Synced ✓") : (res.error ?? "Failed"));
      if (res.ok) router.refresh();
      setTimeout(() => setMsg(""), 5000);
    });

  return (
    <div>
      <button
        onClick={sync}
        disabled={pending}
        className="w-full bg-white border border-slate-200 text-slate-900 text-sm font-medium py-2.5 rounded-lg hover:border-amber-400 hover:bg-amber-50 transition disabled:opacity-50"
      >
        {pending ? "🔄 Checking…" : "🔄 Sync Courier Status"}
      </button>
      {msg && (
        <p className="text-xs text-slate-700 bg-slate-100 rounded-lg px-3 py-2 mt-2">
          {msg}
        </p>
      )}
    </div>
  );
}
