"use client";

import { useRouter } from "next/navigation";
import { formatBDT, formatDate } from "@/lib/utils";

export type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  district: string | null;
  orderCount: number;
  spent: number;
  joined: string;
};

/** Whole-row click → customer detail (no dead clicks). */
export default function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const router = useRouter();

  return (
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-600">
                  কোনো customer পাওয়া যায়নি।
                </td>
              </tr>
            )}
            {rows.map((c) => (
              <tr
                key={c.id}
                onClick={() => router.push(`/admin/customers/${c.id}`)}
                className="hover:bg-amber-50/60 transition cursor-pointer"
              >
                <td className="px-4 py-3">
                  <span className="text-amber-700 font-medium">{c.name}</span>
                </td>
                <td className="px-4 py-3">
                  <a
                    href={`tel:${c.phone}`}
                    onClick={(e) => e.stopPropagation()}
                    className="text-slate-700 hover:text-amber-700"
                  >
                    {c.phone}
                  </a>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.district ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-slate-100 px-2 py-1 rounded-full text-slate-700">
                    {c.orderCount}
                  </span>
                </td>
                <td className="px-4 py-3 font-display text-slate-900 whitespace-nowrap">
                  {formatBDT(c.spent)}
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {formatDate(c.joined)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
