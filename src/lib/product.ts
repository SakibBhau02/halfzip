import { prisma } from "@/lib/prisma";
import { displayUrl } from "@/lib/storage";

export type PublicVariant = {
  id: string;
  color: string;
  colorHex: string;
  size: string;
  price: number;
  stock: number;
  active: boolean;
};

export type PublicColor = {
  name: string;
  hex: string;
  image: string;
  variants: PublicVariant[];
};

export type PublicProduct = {
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
  colors: PublicColor[];
  sizes: string[];
};

const FALLBACK: PublicProduct = {
  id: "fallback",
  name: "Hooded Puffer Jacket",
  tagline: "Premium Winter Jacket",
  description:
    "হালকা ওজনের প্রিমিয়াম পাফার জ্যাকেট — হুডসহ, ভেতরে উষ্ণ ফিল।",
  basePrice: 160000,
  oldPrice: 199000,
  insideFee: 6000,
  outsideFee: 12000,
  combo2Price: 320000,
  combo3Price: 480000,
  freeDeliveryAt: 2,
  colors: [],
  sizes: ["M", "L", "XL", "XXL"],
};

/**
 * Load the single active product with its color-grouped variants.
 * Falls back to static data so the landing page never crashes.
 */
export async function getPublicProduct(): Promise<PublicProduct> {
  try {
    const product = await prisma.product.findFirst({
      where: { active: true },
      include: {
        variants: { where: { active: true } },
        images: { orderBy: { sortOrder: "asc" } },
      },
    });
    if (!product) return FALLBACK;

    const sizeSet = new Set<string>();
    const colorMap = new Map<string, PublicColor>();

    for (const v of product.variants) {
      sizeSet.add(v.size);
      if (!colorMap.has(v.color)) {
        const img =
          product.images.find((i) => i.color === v.color)?.url ??
          product.images[0]?.url ??
          "";
        colorMap.set(v.color, {
          name: v.color,
          hex: v.colorHex,
          image: displayUrl(img),
          variants: [],
        });
      }
      colorMap.get(v.color)!.variants.push({
        id: v.id,
        color: v.color,
        colorHex: v.colorHex,
        size: v.size,
        price: v.price,
        stock: v.stock,
        active: v.active,
      });
    }

    const sizeOrder = ["XS", "S", "M", "L", "XL", "XXL", "3XL"];
    const sizes = Array.from(sizeSet).sort(
      (a, b) => sizeOrder.indexOf(a) - sizeOrder.indexOf(b)
    );

    return {
      id: product.id,
      name: product.name,
      tagline: product.tagline ?? FALLBACK.tagline,
      description: product.description ?? FALLBACK.description,
      basePrice: product.basePrice,
      oldPrice: product.oldPrice ?? 0,
      insideFee: product.insideFee,
      outsideFee: product.outsideFee,
      combo2Price: product.combo2Price,
      combo3Price: product.combo3Price,
      freeDeliveryAt: product.freeDeliveryAt,
      colors: Array.from(colorMap.values()),
      sizes: sizes.length ? sizes : FALLBACK.sizes,
    };
  } catch {
    return FALLBACK;
  }
}
