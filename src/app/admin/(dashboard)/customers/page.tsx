import { prisma } from "@/lib/prisma";
import CustomersTable from "@/components/admin/CustomersTable";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const q = searchParams.q?.trim();
  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { phone: { contains: q } },
          { email: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const customers = await prisma.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      orders: { select: { total: true, status: true } },
    },
    take: 200,
  });

  const rows = customers.map((c) => {
    const delivered = c.orders.filter((o) => o.status === "DELIVERED");
    return {
      id: c.id,
      name: c.name ?? "Unnamed",
      phone: c.phone,
      district: c.district,
      orderCount: c.orders.length,
      spent: delivered.reduce((s, o) => s + o.total, 0),
      joined: c.createdAt.toISOString(),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-slate-900">Customers</h1>
          <p className="text-sm text-slate-600 mt-1">
            {customers.length} customer{customers.length === 1 ? "" : "s"}
          </p>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search name, phone, email…"
            className="rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-gold min-w-[240px]"
          />
          <button className="bg-slate-100 hover:bg-slate-200 text-slate-900 text-sm px-4 rounded-lg transition">
            Search
          </button>
        </form>
      </div>

      <CustomersTable rows={rows} />
    </div>
  );
}
