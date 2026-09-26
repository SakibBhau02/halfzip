import { prisma } from "@/lib/prisma";
import ProductEditor from "@/components/admin/ProductEditor";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const product = await prisma.product.findFirst({
    include: {
      variants: { orderBy: [{ color: "asc" }, { size: "asc" }] },
      images: { orderBy: { sortOrder: "asc" } },
    },
  });

  if (!product) {
    return (
      <div className="text-center py-20">
        <h1 className="font-display text-2xl text-slate-900">No product found</h1>
        <p className="text-slate-600 mt-2">
          Run <code className="text-gold">npm run db:seed</code> to create the
          initial product.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-slate-900">Product</h1>
        <p className="text-sm text-slate-600 mt-1">
          Manage price, sizes, colors and images
        </p>
      </div>
      <ProductEditor
        product={{
          id: product.id,
          name: product.name,
          tagline: product.tagline ?? "",
          description: product.description ?? "",
          basePrice: product.basePrice,
          oldPrice: product.oldPrice ?? 0,
          insideFee: product.insideFee,
          outsideFee: product.outsideFee,
          combo2Price: product.combo2Price,
          combo3Price: product.combo3Price,
          freeDeliveryAt: product.freeDeliveryAt,
          active: product.active,
        }}
        variants={product.variants.map((v) => ({
          id: v.id,
          color: v.color,
          colorHex: v.colorHex,
          size: v.size,
          sku: v.sku,
          price: v.price,
          stock: v.stock,
          active: v.active,
        }))}
        images={product.images.map((i) => ({
          id: i.id,
          url: i.url,
          alt: i.alt ?? "",
          color: i.color ?? "",
          sortOrder: i.sortOrder,
        }))}
      />
    </div>
  );
}
