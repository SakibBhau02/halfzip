"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "grid" },
  { href: "/admin/orders", label: "Orders", icon: "cart" },
  { href: "/admin/products", label: "Product", icon: "box" },
  { href: "/admin/suppliers", label: "Suppliers", icon: "users" },
  { href: "/admin/accounting", label: "Accounting", icon: "wallet" },
  { href: "/admin/customers", label: "Customers", icon: "customers" },
  { href: "/admin/settings", label: "Settings", icon: "cog" },
];

function NavIcon({ name }: { name: string }) {
  const c = "w-5 h-5";
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "grid":
      return (
        <svg viewBox="0 0 24 24" className={c} {...common}>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      );
    case "cart":
      return (
        <svg viewBox="0 0 24 24" className={c} {...common}>
          <circle cx="9" cy="20" r="1.5" />
          <circle cx="18" cy="20" r="1.5" />
          <path d="M2 3h3l2.4 12.4a2 2 0 002 1.6h8.7a2 2 0 002-1.6L21 7H6" />
        </svg>
      );
    case "box":
      return (
        <svg viewBox="0 0 24 24" className={c} {...common}>
          <path d="M21 8l-9-5-9 5 9 5 9-5z" />
          <path d="M3 8v8l9 5 9-5V8" />
          <path d="M12 13v8" />
        </svg>
      );
    case "cog":
      return (
        <svg viewBox="0 0 24 24" className={c} {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.14.4.5.7.92.79H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" className={c} {...common}>
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
        </svg>
      );
    case "wallet":
      return (
        <svg viewBox="0 0 24 24" className={c} {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20M16 15h2" />
        </svg>
      );
    case "customers":
      return (
        <svg viewBox="0 0 24 24" className={c} {...common}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0113 0" />
          <path d="M17 8.5a3 3 0 100-6M21.5 20a6 6 0 00-4.5-5.8" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={c} {...common}>
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20a6.5 6.5 0 0113 0" />
          <path d="M17 8.5a3 3 0 100-6M21.5 20a6 6 0 00-4.5-5.8" />
        </svg>
      );
  }
}

export default function AdminShell({
  children,
  email,
}: {
  children: React.ReactNode;
  email: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 flex">
      <aside
        className={`fixed md:static z-50 inset-y-0 left-0 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform ${
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="px-6 py-5 border-b border-slate-100">
          <p className="font-display text-lg text-slate-900">
            MANZA<span className="text-gold">·</span>BD
          </p>
          <p className="text-[11px] text-slate-600 mt-0.5">Admin Console</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => {
            const active =
              n.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition ${
                  active
                    ? "bg-gold/15 text-gold font-medium"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <NavIcon name={n.icon} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-slate-600">Signed in as</p>
            <p className="text-sm text-slate-900 truncate">{email}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/admin/login" })}
            className="w-full text-left px-3.5 py-2.5 rounded-lg text-sm text-rose-500 hover:bg-rose-50 transition"
          >
            Sign out
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 bg-black/30 z-40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setOpen(true)}
            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center"
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-display text-slate-900">
            MANZA<span className="text-gold">·</span>BD
          </span>
          <span className="w-9" />
        </header>

        <main className="flex-1 p-4 sm:p-5 md:p-8 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
