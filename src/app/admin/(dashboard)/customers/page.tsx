import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBDT, formatDate } from "@/lib/utils";

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

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                {["Customer", "Phone", "District", "Orders", "Total Spent", "Joined"].map(
                  (h) => (
                    <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {customers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-600">
                    কোনো customer পাওয়া যায়নি।
                  </td>
                </tr>
              )}
              {customers.map((c) => {
                const delivered = c.orders.filter((o) => o.status === "DELIVERED");
                const spent = delivered.reduce((s, o) => s + o.total, 0);
                return (
                  <tr key={c.id} className="hover:bg-slate-100 transition">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/customers/${c.id}`}
                        className="text-gold hover:underline font-medium"
                      >
                        {c.name ?? "Unnamed"}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={`tel:${c.phone}`}
                        className="text-slate-700 hover:text-gold"
                      >
                        {c.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.district ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-700">
                        {c.orders.length}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-display text-slate-900 whitespace-nowrap">
                      {formatBDT(spent)}
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {formatDate(c.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
