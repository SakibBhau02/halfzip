import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ManualOrderForm from "@/components/admin/ManualOrderForm";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const product = await prisma.product.findFirst({
    include: {
      variants: {
        where: { active: true },
        orderBy: [{ color: "asc" }, { size: "asc" }],
      },
    },
  });

  if (!product) {
    return (
      <div className="text-center py-20 text-slate-500">
        কোনো active product পাওয়া যায়নি। Product page থেকে যোগ করুন।
      </div>
    );
  }

  const colorMap = new Map<string, string>();
  const sizeSet = new Set<string>();
  for (const v of product.variants) {
    if (!colorMap.has(v.color)) colorMap.set(v.color, v.colorHex);
    sizeSet.add(v.size);
  }
  const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
  const sizes = Array.from(sizeSet).sort(
    (a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b)
  );

  const variants = product.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    price: v.price,
    stock: v.stock,
    color: v.color,
    colorHex: v.colorHex,
    size: v.size,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/orders" className="text-xs text-slate-500 hover:text-amber-700">
          ← Back to orders
        </Link>
        <h1 className="font-display text-3xl text-slate-900 mt-1">New Order</h1>
        <p className="text-sm text-slate-600 mt-1">
          ম্যানুয়ালি অর্ডার তৈরি করুন — কম্বো সহ (ফোন/মেসেঞ্জার অর্ডারের জন্য)
        </p>
      </div>
      <ManualOrderForm
        variants={variants}
        colors={Array.from(colorMap.entries()).map(([name, hex]) => ({ name, hex }))}
        sizes={sizes}
        insideFee={product.insideFee}
        outsideFee={product.outsideFee}
        basePrice={product.basePrice}
        combo2Price={product.combo2Price}
        combo3Price={product.combo3Price}
        freeDeliveryAt={product.freeDeliveryAt}
      />
    </div>
  );
}
