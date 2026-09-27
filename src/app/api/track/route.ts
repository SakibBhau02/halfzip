import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const digits = (s: string) => s.replace(/\D/g, "").slice(-11);

/**
 * Public order tracking lookup.
 * - orderNumber + phone → full details of that order (must match).
 * - phone only → list of that customer's orders to pick from.
 */
export async function GET(req: NextRequest) {
  const orderNumber = req.nextUrl.searchParams.get("orderNumber")?.trim() ?? "";
  const phone = req.nextUrl.searchParams.get("phone")?.trim() ?? "";

  if (!phone) {
    return NextResponse.json(
      { error: "মোবাইল নাম্বার দিন।" },
      { status: 422 }
    );
  }

  // Phone-only: list my orders
  if (!orderNumber) {
    const all = await prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        orderNumber: true,
        shipPhone: true,
        status: true,
        total: true,
        courierName: true,
        trackingId: true,
        createdAt: true,
        items: { select: { variantLabel: true, quantity: true } },
      },
    });
    const mine = all
      .filter((o) => digits(o.shipPhone) === digits(phone))
      .slice(0, 20);
    if (mine.length === 0) {
      return NextResponse.json(
        { error: "এই নম্বরে কোনো অর্ডার পাওয়া যায়নি।" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      orders: mine.map((o) => ({
        orderNumber: o.orderNumber,
        status: o.status,
        total: o.total,
        courierName: o.courierName,
        trackingId: o.trackingId,
        createdAt: o.createdAt.toISOString(),
        itemSummary: o.items
          .map((i) => `${i.variantLabel} ×${i.quantity}`)
          .join(", "),
      })),
    });
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      statusHistory: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!order || digits(order.shipPhone) !== digits(phone)) {
    return NextResponse.json(
      { error: "অর্ডার পাওয়া যায়নি। নম্বর ঠিক আছে কি না দেখুন।" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    orderNumber: order.orderNumber,
    status: order.status,
    total: order.total,
    deliveryFee: order.deliveryFee,
    advancePaid: order.advancePaid,
    paymentStatus: order.paymentStatus,
    courierName: order.courierName,
    trackingId: order.trackingId,
    trackingUrl: order.trackingUrl,
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((i) => ({
      productName: i.productName,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
    })),
    timeline: order.statusHistory.map((h) => ({
      from: h.from,
      to: h.to,
      note: h.note,
      at: h.createdAt.toISOString(),
    })),
  });
}
