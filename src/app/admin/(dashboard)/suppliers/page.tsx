import { prisma } from "@/lib/prisma";
import { formatBDT } from "@/lib/utils";
import { getSupplierBalance } from "@/lib/supplier";
import SuppliersManager from "@/components/admin/SuppliersManager";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const suppliers = await prisma.supplier.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      costPrices: true,
      _count: { select: { forwards: true } },
    },
  });
  const product = await prisma.product.findFirst();

  const withBalance = await Promise.all(
    suppliers.map(async (s) => {
      const bal = await getSupplierBalance(s.id);
      return {
        id: s.id,
        name: s.name,
        company: s.company ?? "",
        phone: s.phone,
        email: s.email ?? "",
        telegram: s.telegramChatId ?? "",
        active: s.active,
        forwards: s._count.forwards,
        costPrice: s.costPrices.find((c) => c.productId === product?.id)?.costPrice ?? 0,
        earned: bal.earned,
        withdrawn: bal.withdrawn,
        balance: bal.balance,
      };
    })
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-slate-900">Suppliers</h1>
        <p className="text-sm text-slate-500 mt-1">
          Supplier তৈরি করুন, cost price ও balance দেখুন
        </p>
      </div>
      <SuppliersManager
        suppliers={withBalance}
        basePrice={product?.basePrice ?? 0}
      />
    </div>
  );
}
