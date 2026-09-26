"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOrderDetails, deleteOrder } from "@/app/admin/(dashboard)/orders/actions";

export default function OrderEdit({
  orderId,
  initial,
}: {
  orderId: string;
  initial: {
    customerName: string;
    phone: string;
    address: string;
    district: string;
    notes: string;
    zone: "inside" | "outside";
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  const [f, setF] = useState(initial);

  const inputCls =
    "w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-gold focus:ring-2 focus:ring-gold/20";

  const save = () =>
    start(async () => {
      const res = await updateOrderDetails(orderId, {
        customerName: f.customerName,
        phone: f.phone,
        address: f.address,
        district: f.district,
        notes: f.notes,
        zone: f.zone,
      });
      setMsg(res.ok ? "Saved ✓" : res.error ?? "Failed");
      setTimeout(() => setMsg(""), 2500);
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (
        !confirm(
          "এই order পুরোপুরি ডিলিট হবে এবং stock ফেরত যাবে। নিশ্চিত?"
        )
      )
        return;
      const res = await deleteOrder(orderId);
      if (res.ok) router.push("/admin/orders");
    });

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-slate-900 font-medium">Edit Order</h2>
        <button
          onClick={() => setOpen(!open)}
          className="text-xs text-gold hover:underline"
        >
          {open ? "Close" : "Edit"}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Name</label>
            <input
              value={f.customerName}
              onChange={(e) => setF({ ...f, customerName: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Phone</label>
            <input
              value={f.phone}
              onChange={(e) => setF({ ...f, phone: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Address</label>
            <textarea
              value={f.address}
              onChange={(e) => setF({ ...f, address: e.target.value })}
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">District</label>
            <input
              value={f.district}
              onChange={(e) => setF({ ...f, district: e.target.value })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">
              Delivery Zone
            </label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { k: "inside", l: "Inside Dhaka" },
                { k: "outside", l: "Outside Dhaka" },
              ].map((z) => (
                <button
                  key={z.k}
                  type="button"
                  onClick={() => setF({ ...f, zone: z.k as "inside" | "outside" })}
                  className={`py-2 rounded-lg border text-xs transition ${
                    f.zone === z.k
                      ? "bg-slate-900 text-white border-slate-900"
                      : "border-slate-200 text-slate-600"
                  }`}
                >
                  {z.l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Notes</label>
            <textarea
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={save}
              disabled={pending}
              className="bg-gold text-ink text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-60"
            >
              Save Changes
            </button>
            {msg && <span className="text-xs text-emerald-600">{msg}</span>}
          </div>

          <button
            onClick={remove}
            disabled={pending}
            className="w-full mt-2 text-sm text-rose-600 border border-rose-200 hover:bg-rose-50 py-2 rounded-lg transition"
          >
            Delete Order & Restore Stock
          </button>
        </div>
      )}
    </div>
  );
}
