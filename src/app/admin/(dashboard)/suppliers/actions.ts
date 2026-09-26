"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getSupplierBalance } from "@/lib/supplier";
import type { CourierProvider } from "@prisma/client";

type Result = { ok: boolean; error?: string; id?: string };

async function requireAdmin() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") throw new Error("Unauthorized");
  return session.user?.email ?? "admin";
}

/* ----------------------------- create supplier ---------------------------- */

export async function createSupplier(input: {
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  password: string;
  costPrice: number;
}): Promise<Result> {
  let actor = "admin";
  try {
    actor = await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!input.name.trim()) return { ok: false, error: "Supplier name দরকার।" };
  if (!/^01[3-9]\d{8}$/.test(input.phone))
    return { ok: false, error: "সঠিক ফোন নাম্বার দিন।" };
  if (!/^\S+@\S+\.\S+$/.test(input.email))
    return { ok: false, error: "সঠিক email দিন।" };
  if (input.password.length < 6)
    return { ok: false, error: "Password কমপক্ষে ৬ অক্ষর।" };

  const exists = await prisma.user.findUnique({
    where: { email: input.email.toLowerCase().trim() },
  });
  if (exists) return { ok: false, error: "এই email আগেই ব্যবহৃত।" };

  const hash = await bcrypt.hash(input.password, 12);
  const supplier = await prisma.$transaction(async (tx) => {
    const s = await tx.supplier.create({
      data: {
        name: input.name,
        company: input.company || null,
        phone: input.phone,
        email: input.email.toLowerCase().trim(),
        address: input.address || null,
      },
    });
    await tx.user.create({
      data: {
        email: input.email.toLowerCase().trim(),
        name: input.name,
        passwordHash: hash,
        role: "SUPPLIER",
        supplierId: s.id,
      },
    });
    const product = await tx.product.findFirst();
    if (product) {
      await tx.supplierProductCost.create({
        data: {
          supplierId: s.id,
          productId: product.id,
          costPrice: input.costPrice || product.basePrice,
        },
      });
    }
    return s;
  });

  revalidatePath("/admin/suppliers");
  return { ok: true, id: supplier.id };
}

export async function updateSupplierCost(
  supplierId: string,
  costPrice: number
): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const product = await prisma.product.findFirst();
  if (!product) return { ok: false, error: "No product" };
  await prisma.supplierProductCost.upsert({
    where: {
      supplierId_productId: { supplierId, productId: product.id },
    },
    update: { costPrice },
    create: { supplierId, productId: product.id, costPrice },
  });
  revalidatePath("/admin/suppliers");
  return { ok: true };
}

export async function toggleSupplierActive(
  supplierId: string,
  active: boolean
): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  await prisma.supplier.update({ where: { id: supplierId }, data: { active } });
  revalidatePath("/admin/suppliers");
  return { ok: true };
}

/* ------------------------------- forwarding ------------------------------- */

export async function forwardOrderToSupplier(
  orderId: string,
  supplierId: string
): Promise<Result> {
  let actor = "admin";
  try {
    actor = await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, supplierOrder: true },
  });
  if (!order) return { ok: false, error: "Order পাওয়া যায়নি।" };
  if (order.supplierOrder)
    return { ok: false, error: "এই order আগেই forward করা হয়েছে।" };

  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: { costPrices: true },
  });
  if (!supplier) return { ok: false, error: "Supplier পাওয়া যায়নি।" };
  if (!supplier.active) return { ok: false, error: "Supplier নিষ্ক্রিয়।" };

  const product = await prisma.product.findFirst();
  const costEntry = supplier.costPrices.find(
    (c) => c.productId === product?.id
  );
  const costPerPiece = costEntry?.costPrice ?? product?.basePrice ?? 0;
  const supplierCost = costPerPiece * order.items.length;

  await prisma.$transaction(async (tx) => {
    await tx.supplierOrder.create({
      data: {
        orderId,
        supplierId,
        supplierCost,
        status: "PENDING",
        note: `Forwarded by ${actor}`,
      },
    });
    await tx.order.update({
      where: { id: orderId },
      data: { supplierCost },
    });
    await tx.auditLog.create({
      data: {
        orderId,
        action: "FORWARDED_TO_SUPPLIER",
        field: "supplierId",
        newValue: supplier.name,
        actor,
      },
    });
  });

  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
  revalidatePath("/admin/suppliers");
  return { ok: true };
}

export async function recallForward(orderId: string): Promise<Result> {
  let actor = "admin";
  try {
    actor = await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const so = await prisma.supplierOrder.findUnique({ where: { orderId } });
  if (!so) return { ok: false, error: "Forward পাওয়া যায়নি।" };
  if (so.status === "SHIPPED" || so.status === "DELIVERED")
    return { ok: false, error: "Ship হয়ে গেছে — recall করা যাবে না।" };

  await prisma.$transaction(async (tx) => {
    await tx.supplierOrder.delete({ where: { orderId } });
    await tx.order.update({ where: { id: orderId }, data: { supplierCost: 0 } });
    await tx.auditLog.create({
      data: { orderId, action: "RECALLED_FROM_SUPPLIER", actor },
    });
  });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/suppliers");
  return { ok: true };
}

/* ------------------------------- withdrawals ------------------------------ */

/** Admin requests a withdrawal of the reseller's margin from the supplier. */
export async function requestWithdrawal(
  supplierId: string,
  amount: number,
  method: string,
  note: string
): Promise<Result> {
  let actor = "admin";
  try {
    actor = await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (amount < 1) return { ok: false, error: "Amount সঠিক নয়।" };
  const { balance } = await getSupplierBalance(supplierId);
  if (amount > balance)
    return {
      ok: false,
      error: `Supplier এখনো ৳${(balance / 100).toLocaleString("en-BD")} পাওনা — এর বেশি request করা যাবে না।`,
    };

  await prisma.supplierPayout.create({
    data: {
      supplierId,
      amount,
      method,
      note: note || `Requested by ${actor}`,
      status: "REQUESTED",
    },
  });
  revalidatePath("/admin/accounting");
  revalidatePath("/supplier/earnings");
  return { ok: true };
}

/** Admin marks a withdrawal as received (supplier has transferred the money). */
export async function markWithdrawalReceived(
  payoutId: string,
  reference: string
): Promise<Result> {
  let actor = "admin";
  try {
    actor = await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const payout = await prisma.supplierPayout.findUnique({
    where: { id: payoutId },
  });
  if (!payout) return { ok: false, error: "Request পাওয়া যায়নি।" };
  if (payout.status === "RECEIVED")
    return { ok: false, error: "Already received." };

  await prisma.$transaction([
    prisma.supplierPayout.update({
      where: { id: payoutId },
      data: { status: "RECEIVED", paidAt: new Date(), reference: reference || null },
    }),
    prisma.supplierLedger.create({
      data: {
        supplierId: payout.supplierId,
        type: "WITHDRAWAL",
        amount: payout.amount,
        note: `Withdrawal received (${payout.method}) ${reference}`,
        actor,
      },
    }),
  ]);
  revalidatePath("/admin/accounting");
  revalidatePath("/supplier/earnings");
  return { ok: true };
}

export async function rejectWithdrawal(
  payoutId: string,
  note: string
): Promise<Result> {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  await prisma.supplierPayout.update({
    where: { id: payoutId },
    data: { status: "REJECTED", note: note || null },
  });
  revalidatePath("/admin/accounting");
  revalidatePath("/supplier/earnings");
  return { ok: true };
}

export async function reloadBalances() {
  try {
    await requireAdmin();
  } catch {
    return {};
  }
  const suppliers = await prisma.supplier.findMany();
  const withBal = await Promise.all(
    suppliers.map(async (s) => ({ id: s.id, ...(await getSupplierBalance(s.id)) }))
  );
  return withBal;
}
