"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatBDT } from "@/lib/utils";
import {
  createSupplier,
  updateSupplierCost,
  toggleSupplierActive,
  updateSupplierTelegram,
} from "@/app/admin/(dashboard)/suppliers/actions";

type Row = {
  id: string;
  name: string;
  company: string;
  phone: string;
  email: string;
  telegram: string;
  active: boolean;
  forwards: number;
  costPrice: number;
  earned: number;
  withdrawn: number;
  balance: number;
};

function CostCell({ supplier }: { supplier: Row }) {
  const [cost, setCost] = useState((supplier.costPrice / 100).toString());
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const save = () =>
    start(async () => {
      await updateSupplierCost(supplier.id, Math.round(Number(cost) * 100));
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-400 text-xs">৳</span>
      <input
        type="number"
        value={cost}
        onChange={(e) => setCost(e.target.value)}
        className="w-20 rounded border border-slate-200 px-2 py-1 text-sm outline-none focus:border-amber-400"
      />
      <button
        onClick={save}
        disabled={pending}
        className="text-[11px] px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40"
      >
        {saved ? "✓" : "Save"}
      </button>
    </div>
  );
}

function TelegramCell({ supplier }: { supplier: Row }) {
  const router = useRouter();
  const [chatId, setChatId] = useState(supplier.telegram);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const save = () =>
    start(async () => {
      await updateSupplierTelegram(supplier.id, chatId);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      router.refresh();
    });

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-base">{supplier.telegram ? "🔔" : "🔕"}</span>
      <input
        value={chatId}
        onChange={(e) => setChatId(e.target.value)}
        placeholder="Chat ID"
        className="w-24 rounded border border-slate-200 px-2 py-1 text-sm font-mono outline-none focus:border-amber-400"
      />
      <button
        onClick={save}
        disabled={pending}
        className="text-[11px] px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-40"
      >
        {saved ? "✓" : "Save"}
      </button>
    </div>
  );
}

export default function SuppliersManager({
  suppliers,
  basePrice,
}: {
  suppliers: Row[];
  basePrice: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  const [f, setF] = useState({
    name: "",
    company: "",
    phone: "",
    email: "",
    address: "",
    password: "",
    costPrice: basePrice ? (basePrice / 100).toString() : "",
  });

  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100";

  const create = () =>
    start(async () => {
      setMsg("");
      const res = await createSupplier({
        ...f,
        costPrice: Math.round(Number(f.costPrice || 0) * 100),
      });
      if (!res.ok) setMsg(res.error ?? "Failed");
      else {
        setOpen(false);
        setF({
          name: "",
          company: "",
          phone: "",
          email: "",
          address: "",
          password: "",
          costPrice: basePrice ? (basePrice / 100).toString() : "",
        });
        router.refresh();
      }
    });

  const toggle = (id: string, active: boolean) =>
    start(async () => {
      await toggleSupplierActive(id, active);
      router.refresh();
    });

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <button
          onClick={() => setOpen(true)}
          className="bg-gold text-ink text-sm font-semibold px-5 py-2.5 rounded-lg hover:brightness-110 transition"
        >
          + New Supplier
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[980px]">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                {[
                  "Supplier",
                  "Contact",
                  "Cost / pc",
                  "Telegram",
                  "Forwards",
                  "Margin Due",
                  "Owed",
                  "Status",
                ].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    এখনো কোনো supplier নেই।
                  </td>
                </tr>
              )}
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition">
                  <td className="px-4 py-3">
                    <p className="text-slate-900 font-medium">{s.name}</p>
                    {s.company && (
                      <p className="text-xs text-slate-500">{s.company}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700">{s.phone}</p>
                    <p className="text-xs text-slate-500">{s.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <CostCell supplier={s} />
                  </td>
                  <td className="px-4 py-3">
                    <TelegramCell supplier={s} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{s.forwards}</td>
                  <td className="px-4 py-3 text-slate-700">{formatBDT(s.earned)}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {formatBDT(s.balance)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggle(s.id, !s.active)}
                      disabled={pending}
                      className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${
                        s.active
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {s.active ? "Active" : "Inactive"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* create modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-lg bg-white rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-slate-900 font-semibold text-lg mb-4">
              New Supplier
            </h3>
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Name *
                  </label>
                  <input
                    value={f.name}
                    onChange={(e) => setF({ ...f, name: e.target.value })}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Company
                  </label>
                  <input
                    value={f.company}
                    onChange={(e) => setF({ ...f, company: e.target.value })}
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Phone *
                  </label>
                  <input
                    value={f.phone}
                    onChange={(e) => setF({ ...f, phone: e.target.value })}
                    className={inputCls}
                    placeholder="01XXXXXXXXX"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Login Email *
                  </label>
                  <input
                    value={f.email}
                    onChange={(e) => setF({ ...f, email: e.target.value })}
                    className={inputCls}
                    placeholder="supplier@example.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Login Password *
                </label>
                <input
                  value={f.password}
                  onChange={(e) => setF({ ...f, password: e.target.value })}
                  className={inputCls}
                  placeholder="min 6 chars"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Address
                </label>
                <input
                  value={f.address}
                  onChange={(e) => setF({ ...f, address: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Product Cost / pc (৳)
                </label>
                <input
                  type="number"
                  value={f.costPrice}
                  onChange={(e) => setF({ ...f, costPrice: e.target.value })}
                  className={inputCls}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Supplier আপনাকে এই দামে product দেবে। আপনার sell price ৳
                  {basePrice / 100}.
                </p>
              </div>

              {msg && (
                <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">
                  {msg}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={create}
                  disabled={pending}
                  className="flex-1 bg-gold text-ink font-semibold py-3 rounded-xl hover:brightness-110 transition disabled:opacity-50"
                >
                  {pending ? "Creating…" : "Create Supplier"}
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="px-5 py-3 rounded-xl text-slate-500 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
