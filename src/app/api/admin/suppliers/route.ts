import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session || role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const product = await prisma.product.findFirst();
  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: { costPrices: true },
  });

  return NextResponse.json({
    suppliers: suppliers.map((s) => ({
      id: s.id,
      name: s.name,
      active: s.active,
      cost: s.costPrices.find((c) => c.productId === product?.id)?.costPrice ?? 0,
    })),
  });
}
