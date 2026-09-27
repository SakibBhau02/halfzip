"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

type Result = { ok: boolean; error?: string; id?: string };

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") throw new Error("Unauthorized");
}

/* ------------------------------- product ------------------------------- */

export async function updateProduct(
  id: string,
  data: {
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
  }
): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  await prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      tagline: data.tagline || null,
      description: data.description || null,
      basePrice: data.basePrice,
      oldPrice: data.oldPrice || null,
      insideFee: data.insideFee,
      outsideFee: data.outsideFee,
      combo2Price: data.combo2Price,
      combo3Price: data.combo3Price,
      freeDeliveryAt: data.freeDeliveryAt,
      active: data.active,
    },
  });
  revalidatePath("/admin/products");
  revalidatePath("/");
  return { ok: true };
}

/* ------------------------------- variants ------------------------------ */

export async function createVariant(
  productId: string,
  data: { color: string; colorHex: string; size: string; price: number; stock: number }
): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const sku = `${data.color.replace(/\s+/g, "").toUpperCase()}-${data.size}`;
  try {
    const v = await prisma.productVariant.create({
      data: {
        productId,
        color: data.color,
        colorHex: data.colorHex,
        size: data.size,
        price: data.price,
        stock: data.stock,
        sku,
      },
    });
    revalidatePath("/admin/products");
    revalidatePath("/");
    return { ok: true, id: v.id };
  } catch {
    return { ok: false, error: "এই color + size combination আগেই আছে।" };
  }
}

export async function updateVariant(
  id: string,
  data: {
    color: string;
    colorHex: string;
    size: string;
    sku: string;
    price: number;
    stock: number;
    active: boolean;
  }
): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  try {
    await prisma.productVariant.update({
      where: { id },
      data: {
        color: data.color,
        colorHex: data.colorHex,
        size: data.size,
        sku: data.sku,
        price: data.price,
        stock: data.stock,
        active: data.active,
      },
    });
    revalidatePath("/admin/products");
    revalidatePath("/");
    return { ok: true };
  } catch {
    return { ok: false, error: "SKU unique হতে হবে।" };
  }
}

export async function deleteVariant(id: string): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  await prisma.productVariant.delete({ where: { id } });
  revalidatePath("/admin/products");
  revalidatePath("/");
  return { ok: true };
}

export async function createVariantsBulk(
  productId: string,
  data: {
    color: string;
    colorHex: string;
    sizes: string[];
    price: number;
    stock: number;
  }
): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!data.color.trim()) return { ok: false, error: "Color name দরকার।" };
  if (data.sizes.length === 0) return { ok: false, error: "Size নির্বাচন করুন।" };

  const prefix = data.color.replace(/\s+/g, "").toUpperCase();
  let created = 0;
  for (const size of data.sizes) {
    try {
      await prisma.productVariant.create({
        data: {
          productId,
          color: data.color,
          colorHex: data.colorHex,
          size,
          sku: `${prefix}-${size}`,
          price: data.price,
          stock: data.stock,
        },
      });
      created++;
    } catch {
      // skip duplicates
    }
  }
  revalidatePath("/admin/products");
  revalidatePath("/");
  return created > 0
    ? { ok: true }
    : { ok: false, error: "এই color এর সব size আগেই আছে।" };
}

/* -------------------------------- images ------------------------------- */

export async function createImage(
  productId: string,
  data: { url: string; alt: string; color: string }
): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const count = await prisma.productImage.count({ where: { productId } });
  const img = await prisma.productImage.create({
    data: {
      productId,
      url: data.url,
      alt: data.alt || null,
      color: data.color || null,
      sortOrder: count,
    },
  });
  revalidatePath("/admin/products");
  revalidatePath("/");
  return { ok: true, id: img.id };
}

export async function deleteImage(id: string): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const img = await prisma.productImage.findUnique({ where: { id } });
  if (!img) return { ok: false, error: "Image not found" };
  await prisma.productImage.delete({ where: { id } });
  // also remove the S3 object (local files stay — harmless)
  const { s3KeyFromUrl, s3Delete } = await import("@/lib/storage");
  const key = s3KeyFromUrl(img.url);
  if (key) await s3Delete(key);
  revalidatePath("/admin/products");
  revalidatePath("/");
  return { ok: true };
}

/**
 * Set (upload/change) the image for ONE color — mismatch-proof.
 * Replaces the existing image of that color, if any.
 */
export async function setColorImage(
  productId: string,
  data: { url: string; alt: string; color: string }
): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!data.color.trim()) return { ok: false, error: "Color দরকার।" };
  const existing = await prisma.productImage.findFirst({
    where: { productId, color: data.color },
  });
  if (existing) {
    // remove old S3 object to avoid orphans
    const { s3KeyFromUrl, s3Delete } = await import("@/lib/storage");
    const key = s3KeyFromUrl(existing.url);
    await prisma.productImage.update({
      where: { id: existing.id },
      data: { url: data.url, alt: data.alt || null },
    });
    if (key) await s3Delete(key);
  } else {
    const count = await prisma.productImage.count({ where: { productId } });
    await prisma.productImage.create({
      data: {
        productId,
        url: data.url,
        alt: data.alt || null,
        color: data.color,
        sortOrder: count,
      },
    });
  }
  revalidatePath("/admin/products");
  revalidatePath("/");
  return { ok: true };
}

/** Remap an unassigned image to a color. */
export async function updateImageColor(
  id: string,
  color: string
): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  await prisma.productImage.update({
    where: { id },
    data: { color: color.trim() || null },
  });
  revalidatePath("/admin/products");
  revalidatePath("/");
  return { ok: true };
}
