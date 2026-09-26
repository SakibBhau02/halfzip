import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { nextOrderNumber, formatBDT } from "@/lib/utils";
import { sendTelegram, formatOrderTelegram } from "@/lib/telegram";
import { comboSubtotal, comboDelivery } from "@/lib/combo";

export const runtime = "nodejs";

const Item = z.object({
  variantId: z.string().min(1),
});

const Body = z.object({
  name: z.string().min(2, "নাম দিন").max(120),
  phone: z
    .string()
    .regex(/^01[3-9]\d{8}$/, "সঠিক মোবাইল নাম্বার দিন (11 digits)"),
  address: z.string().min(5, "সম্পূর্ণ ঠিকানা দিন").max(500),
  district: z.string().max(80).optional().default(""),
  zone: z.enum(["inside", "outside"]),
  notes: z.string().max(500).optional().default(""),
  items: z.array(Item).min(1, "কমপক্ষে একটি product নির্বাচন করুন").max(3),
});

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 422 }
    );
  }
  const d = parsed.data;

  const product = await prisma.product.findFirst({
    where: { active: true },
    include: { variants: true },
  });
  if (!product) {
    return NextResponse.json({ error: "Product unavailable" }, { status: 503 });
  }

  // resolve all variants
  const resolved: { variant: (typeof product.variants)[number] }[] = [];
  for (const it of d.items) {
    const variant = product.variants.find(
      (v) => v.id === it.variantId && v.active
    );
    if (!variant) {
      return NextResponse.json(
        { error: "নির্বাচিত একটি configuration পাওয়া যায়নি।" },
        { status: 409 }
      );
    }
    if (variant.stock <= 0) {
      return NextResponse.json(
        { error: `${variant.color}/${variant.size} স্টক শেষ।` },
        { status: 409 }
      );
    }
    resolved.push({ variant });
  }

  const qty = resolved.length;
  const goodsTotal = comboSubtotal(
    {
      basePrice: product.basePrice,
      combo2Price: product.combo2Price,
      combo3Price: product.combo3Price,
      freeDeliveryAt: product.freeDeliveryAt,
      insideFee: product.insideFee,
      outsideFee: product.outsideFee,
    },
    qty
  );
  const deliveryFee = comboDelivery(
    {
      basePrice: product.basePrice,
      combo2Price: product.combo2Price,
      combo3Price: product.combo3Price,
      freeDeliveryAt: product.freeDeliveryAt,
      insideFee: product.insideFee,
      outsideFee: product.outsideFee,
    },
    qty,
    d.zone
  );
  const total = goodsTotal + deliveryFee;

  // distribute combo subtotal across items (even split for bookkeeping)
  const perItem = Math.round(goodsTotal / qty);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.upsert({
        where: { phone: d.phone },
        update: {
          name: d.name,
          address: d.address,
          district: d.district || null,
        },
        create: {
          phone: d.phone,
          name: d.name,
          address: d.address,
          district: d.district || null,
        },
      });

      const count = await tx.order.count();
      const orderNumber = nextOrderNumber(count + 1);
      const invCount = await tx.order.count({ where: { invoiceNumber: { not: null } } });
      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invCount + 1).padStart(5, "0")}`;

      const order = await tx.order.create({
        data: {
          orderNumber,
          invoiceNumber,
          customerId: customer.id,
          status: "NEW",
          paymentMethod: "COD",
          paymentStatus: "UNPAID",
          source: "website",
          subtotal: goodsTotal,
          deliveryFee,
          total,
          shipName: d.name,
          shipPhone: d.phone,
          shipAddress: d.address,
          shipDistrict: d.district || null,
          notes: d.notes || null,
          items: {
            create: resolved.map(({ variant }) => ({
              variantId: variant.id,
              quantity: 1,
              unitPrice: perItem,
              productName: product.name,
              variantLabel: `${variant.color} / ${variant.size}`,
            })),
          },
          statusHistory: {
            create: { to: "NEW", actor: "customer", note: `Order placed (${qty} pcs)` },
          },
        },
      });

      for (const { variant } of resolved) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stock: { decrement: 1 } },
        });
      }

      return order;
    });

    // Telegram (must not fail the order)
    await sendTelegram(
      formatOrderTelegram({
        orderNumber: result.orderNumber,
        name: d.name,
        phone: d.phone,
        address: d.address,
        district: d.district,
        color: resolved.map((r) => `${r.variant.color}/${r.variant.size}`).join(", "),
        size: `${qty} পিস`,
        quantity: qty,
        total: formatBDT(result.total),
        delivery: deliveryFee === 0 ? "ফ্রি" : formatBDT(deliveryFee),
        source: "website",
      })
    );

    return NextResponse.json({
      ok: true,
      orderNumber: result.orderNumber,
      total: result.total,
      deliveryFee,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: "অর্ডার সেভ করা যায়নি। আবার চেষ্টা করুন।" },
      { status: 500 }
    );
  }
}
