"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  updateProduct,
  createVariant,
  createVariantsBulk,
  updateVariant,
  deleteVariant,
  createImage,
  deleteImage,
} from "@/app/admin/(dashboard)/products/actions";
import { formatBDT } from "@/lib/utils";

type Variant = {
  id: string;
  color: string;
  colorHex: string;
  size: string;
  sku: string;
  price: number;
  stock: number;
  active: boolean;
};
type ImageRow = {
  id: string;
  url: string;
  alt: string;
  color: string;
  sortOrder: number;
};
type ProductData = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  basePrice: number;
  oldPrice: number;
  insideFee: number;
  outsideFee: number;
  combo2Price: number;
  combo3Price: number;
  freeDeliveryAt: number;
  active: boolean;
};

function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-sm px-4 py-2 rounded-lg transition ${
        active
          ? "bg-gold text-ink font-medium"
          : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------ general tab ----------------------------- */

function GeneralTab({ product }: { product: ProductData }) {
  const [f, setF] = useState(product);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  const save = () =>
    start(async () => {
      const res = await updateProduct(product.id, {
        ...f,
        basePrice: Number(f.basePrice),
        oldPrice: Number(f.oldPrice),
        insideFee: Number(f.insideFee),
        outsideFee: Number(f.outsideFee),
        combo2Price: Number(f.combo2Price),
        combo3Price: Number(f.combo3Price),
        freeDeliveryAt: Number(f.freeDeliveryAt),
      });
      setMsg(res.ok ? "Saved ✓" : res.error ?? "Failed");
      setTimeout(() => setMsg(""), 2500);
    });

  const field = (
    label: string,
    key: keyof ProductData,
    type: "text" | "number" | "textarea" = "text",
    hint?: string
  ) => (
    <div>
      <label className="block text-sm text-slate-600 mb-1.5">
        {label} {hint && <span className="text-slate-600">({hint})</span>}
      </label>
      {type === "textarea" ? (
        <textarea
          value={String(f[key])}
          onChange={(e) => setF({ ...f, [key]: e.target.value })}
          rows={3}
          className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-gold resize-none"
        />
      ) : (
        <input
          type={type}
          value={String(f[key])}
          onChange={(e) =>
            setF({
              ...f,
              [key]: type === "number" ? Number(e.target.value) : e.target.value,
            } as ProductData)
          }
          className="w-full rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-gold"
        />
      )}
    </div>
  );

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {field("Product Name", "name")}
        {field("Tagline", "tagline")}
      </div>
      {field("Description", "description", "textarea")}
      <div className="grid md:grid-cols-2 gap-4">
        {field("Base Price", "basePrice", "number", "in poisha, ৳880 = 88000")}
        {field("Old Price (strike)", "oldPrice", "number", "0 = hide")}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {field("Dhaka Inside Fee", "insideFee", "number", "৳60 = 6000")}
        {field("Dhaka Outside Fee", "outsideFee", "number", "৳120 = 12000")}
      </div>

      <div className="border-t border-slate-100 pt-4">
        <p className="text-sm font-semibold text-slate-900 mb-3">
          Combo Pricing
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {field("2pc Combo Price", "combo2Price", "number", "৳1650 = 165000")}
          {field("3pc Combo Price", "combo3Price", "number", "৳2400 = 240000")}
          {field(
            "Free Delivery From",
            "freeDeliveryAt",
            "number",
            "qty (3 = 3pc-তে ফ্রি)"
          )}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={f.active}
          onChange={(e) => setF({ ...f, active: e.target.checked })}
          className="w-4 h-4 accent-[#c8a24a]"
        />
        Product visible on site
      </label>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={save}
          disabled={pending}
          className="bg-gold text-ink font-semibold px-6 py-2.5 rounded-lg hover:brightness-110 transition disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save Product"}
        </button>
        {msg && <span className="text-sm text-emerald-600">{msg}</span>}
      </div>
    </div>
  );
}

/* ------------------------------ variants tab ---------------------------- */

function VariantRow({
  v,
  onChanged,
}: {
  v: Variant;
  onChanged: () => void;
}) {
  const [price, setPrice] = useState(v.price);
  const [stock, setStock] = useState(v.stock);
  const [active, setActive] = useState(v.active);
  const [sku, setSku] = useState(v.sku);
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  const dirty =
    price !== v.price ||
    stock !== v.stock ||
    active !== v.active ||
    sku !== v.sku;

  const save = () =>
    start(async () => {
      setErr("");
      const res = await updateVariant(v.id, {
        color: v.color,
        colorHex: v.colorHex,
        size: v.size,
        sku,
        price: Number(price),
        stock: Number(stock),
        active,
      });
      if (!res.ok) setErr(res.error ?? "Failed");
      else onChanged();
    });

  const remove = () =>
    start(async () => {
      if (!confirm(`Delete ${v.color} / ${v.size}?`)) return;
      await deleteVariant(v.id);
      onChanged();
    });

  return (
    <tr className="border-b border-slate-200">
      <td className="px-3 py-3">
        <div className="flex items-center gap-2">
          <span
            className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
            style={{ backgroundColor: v.colorHex }}
          />
          <span className="text-sm text-slate-900 whitespace-nowrap">
            {v.color}
          </span>
        </div>
      </td>
      <td className="px-3 py-3 text-sm text-slate-700">{v.size}</td>
      <td className="px-3 py-3">
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="w-36 rounded bg-slate-50 border border-slate-200 px-2 py-1.5 text-xs font-mono text-slate-700 outline-none focus:border-gold"
        />
        {err && <p className="text-[10px] text-rose-500 mt-1">{err}</p>}
      </td>
      <td className="px-3 py-3">
        <input
          type="number"
          value={price}
          onChange={(e) => setPrice(Number(e.target.value))}
          className="w-24 rounded bg-slate-50 border border-slate-200 px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-gold"
        />
      </td>
      <td className="px-3 py-3">
        <input
          type="number"
          value={stock}
          onChange={(e) => setStock(Number(e.target.value))}
          className={`w-20 rounded bg-slate-50 border px-2 py-1.5 text-sm outline-none focus:border-gold ${
            stock <= 3 ? "border-amber-500/50 text-amber-600" : "border-slate-200 text-slate-900"
          }`}
        />
      </td>
      <td className="px-3 py-3">
        <button
          onClick={() => setActive(!active)}
          className={`text-xs px-2.5 py-1 rounded-full ${
            active
              ? "bg-emerald-50 text-emerald-600"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          {active ? "Active" : "Off"}
        </button>
      </td>
      <td className="px-3 py-3">
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={!dirty || pending}
            className="text-xs px-3 py-1.5 rounded bg-gold text-ink font-medium disabled:opacity-30"
          >
            Save
          </button>
          <button
            onClick={remove}
            disabled={pending}
            className="text-xs px-3 py-1.5 rounded bg-rose-50 text-rose-500 hover:bg-rose-100"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function VariantsTab({
  productId,
  variants,
  onChanged,
}: {
  productId: string;
  variants: Variant[];
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"single" | "bulk">("bulk");
  const [nv, setNv] = useState({
    color: "",
    colorHex: "#000000",
    size: "M",
    price: 88000,
    stock: 10,
  });
  const [bulkSizes, setBulkSizes] = useState<string[]>(["M", "L", "XL", "XXL"]);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const inputCls =
    "w-full rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-gold focus:bg-white";

  const addSingle = () =>
    start(async () => {
      setError("");
      if (!nv.color.trim()) {
        setError("Color name দরকার।");
        return;
      }
      const res = await createVariant(productId, nv);
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        setNv({ ...nv, color: "" });
        onChanged();
      }
    });

  const addBulk = () =>
    start(async () => {
      setError("");
      if (!nv.color.trim()) {
        setError("Color name দরকার।");
        return;
      }
      if (bulkSizes.length === 0) {
        setError("কমপক্ষে একটি size নির্বাচন করুন।");
        return;
      }
      const res = await createVariantsBulk(productId, {
        color: nv.color,
        colorHex: nv.colorHex,
        sizes: bulkSizes,
        price: nv.price,
        stock: nv.stock,
      });
      if (!res.ok) setError(res.error ?? "Failed");
      else {
        setNv({ ...nv, color: "" });
        onChanged();
      }
    });

  const toggleSize = (s: string) =>
    setBulkSizes((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );

  const ALL_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];

  return (
    <div className="space-y-5">
      {/* add new */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-slate-900 font-medium">Add Color</h3>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
            <button
              onClick={() => setMode("bulk")}
              className={`text-xs px-3 py-1.5 rounded-md transition ${
                mode === "bulk"
                  ? "bg-white text-slate-900 shadow-sm font-medium"
                  : "text-slate-600"
              }`}
            >
              Bulk (all sizes)
            </button>
            <button
              onClick={() => setMode("single")}
              className={`text-xs px-3 py-1.5 rounded-md transition ${
                mode === "single"
                  ? "bg-white text-slate-900 shadow-sm font-medium"
                  : "text-slate-600"
              }`}
            >
              Single
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-5 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="block text-xs text-slate-600 mb-1">Color Name</label>
            <input
              value={nv.color}
              onChange={(e) => setNv({ ...nv, color: e.target.value })}
              placeholder="e.g. Sky Blue"
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Swatch</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={nv.colorHex}
                onChange={(e) => setNv({ ...nv, colorHex: e.target.value })}
                className="w-9 h-9 rounded cursor-pointer bg-transparent border border-slate-200"
              />
              <input
                value={nv.colorHex}
                onChange={(e) => setNv({ ...nv, colorHex: e.target.value })}
                className="w-20 rounded-lg bg-slate-50 border border-slate-200 px-2 py-2 text-xs text-slate-900 outline-none focus:border-gold"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Price</label>
            <input
              type="number"
              value={nv.price}
              onChange={(e) => setNv({ ...nv, price: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Stock</label>
            <input
              type="number"
              value={nv.stock}
              onChange={(e) => setNv({ ...nv, stock: Number(e.target.value) })}
              className={inputCls}
            />
          </div>
        </div>

        {mode === "bulk" ? (
          <div className="mt-4">
            <label className="block text-xs text-slate-600 mb-2">
              Sizes — SKU স্বয়ংক্রিয়ভাবে তৈরি হবে (COLOR-SIZE)
            </label>
            <div className="flex flex-wrap gap-2">
              {ALL_SIZES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSize(s)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition ${
                    bulkSizes.includes(s)
                      ? "bg-slate-900 text-white border-slate-900"
                      : "border-slate-200 text-slate-600 hover:border-slate-400"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              onClick={addBulk}
              disabled={pending}
              className="mt-4 bg-gold text-ink font-semibold px-6 py-2.5 rounded-lg hover:brightness-110 transition disabled:opacity-60"
            >
              {pending ? "Adding…" : `+ Add ${bulkSizes.length} Variants`}
            </button>
          </div>
        ) : (
          <div className="mt-4 flex items-end gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Size</label>
              <input
                value={nv.size}
                onChange={(e) => setNv({ ...nv, size: e.target.value })}
                className={`${inputCls} w-32`}
              />
            </div>
            <button
              onClick={addSingle}
              disabled={pending}
              className="bg-gold text-ink font-semibold px-6 py-2.5 rounded-lg hover:brightness-110 transition disabled:opacity-60"
            >
              {pending ? "Adding…" : "+ Add Variant"}
            </button>
          </div>
        )}

        {error && <p className="text-xs text-rose-500 mt-3">{error}</p>}
      </div>

      {/* table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-3 text-left font-medium">Color</th>
                <th className="px-3 py-3 text-left font-medium">Size</th>
                <th className="px-3 py-3 text-left font-medium">SKU</th>
                <th className="px-3 py-3 text-left font-medium">Price</th>
                <th className="px-3 py-3 text-left font-medium">Stock</th>
                <th className="px-3 py-3 text-left font-medium">Status</th>
                <th className="px-3 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <VariantRow key={v.id} v={v} onChanged={onChanged} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- images tab ----------------------------- */

function ImagesTab({
  productId,
  images,
  onChanged,
}: {
  productId: string;
  images: ImageRow[];
  onChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [color, setColor] = useState("");
  const [pending, start] = useTransition();

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Upload failed");
        return;
      }
      await createImage(productId, {
        url: data.url,
        alt: "",
        color,
      });
      onChanged();
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const remove = (id: string) =>
    start(async () => {
      if (!confirm("Delete this image?")) return;
      await deleteImage(id);
      onChanged();
    });

  return (
    <div className="space-y-5">
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-slate-900 font-medium mb-3">Upload Image</h3>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="Map to color (optional)"
            className="rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-gold"
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
            }}
            className="text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-gold file:text-ink file:font-medium hover:file:brightness-110"
          />
          {uploading && <span className="text-sm text-slate-600">Uploading…</span>}
        </div>
        <p className="text-xs text-slate-600 mt-2">
          JPG / PNG / WebP / AVIF · max 5MB
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {images.map((img) => (
          <div
            key={img.id}
            className="group relative aspect-[3/4] rounded-xl overflow-hidden bg-white border border-slate-200"
          >
            <Image
              src={img.url}
              alt={img.alt || "product"}
              fill
              sizes="25vw"
              className="object-cover"
            />
            {img.color && (
              <span className="absolute top-2 left-2 text-[10px] bg-black/70 text-slate-900 px-2 py-0.5 rounded-full">
                {img.color}
              </span>
            )}
            <button
              onClick={() => remove(img.id)}
              disabled={pending}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-rose-600 text-slate-900 text-xs opacity-0 group-hover:opacity-100 transition"
              aria-label="Delete"
            >
              ✕
            </button>
          </div>
        ))}
        {images.length === 0 && (
          <p className="col-span-full text-center text-slate-600 py-8">
            এখনো কোনো image নেই।
          </p>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- wrapper ------------------------------- */

export default function ProductEditor({
  product,
  variants,
  images,
}: {
  product: ProductData;
  variants: Variant[];
  images: ImageRow[];
}) {
  const [tab, setTab] = useState<"general" | "variants" | "images">("general");
  const [, start] = useTransition();
  const router = useRouter();

  const refresh = () => start(() => router.refresh());

  return (
    <div className="space-y-5">
      <div className="flex gap-1 bg-slate-100 rounded-lg p-1 w-fit">
        <Tab active={tab === "general"} onClick={() => setTab("general")}>
          General
        </Tab>
        <Tab active={tab === "variants"} onClick={() => setTab("variants")}>
          Variants · {variants.length}
        </Tab>
        <Tab active={tab === "images"} onClick={() => setTab("images")}>
          Images · {images.length}
        </Tab>
      </div>

      {tab === "general" && <GeneralTab product={product} />}
      {tab === "variants" && (
        <VariantsTab
          productId={product.id}
          variants={variants}
          onChanged={refresh}
        />
      )}
      {tab === "images" && (
        <ImagesTab
          productId={product.id}
          images={images}
          onChanged={refresh}
        />
      )}
    </div>
  );
}
