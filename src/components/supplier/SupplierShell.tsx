"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/supplier", label: "Dashboard", icon: "grid" },
  { href: "/supplier/orders", label: "Orders", icon: "cart" },
  { href: "/supplier/courier", label: "Courier Setup", icon: "truck" },
  { href: "/supplier/earnings", label: "Earnings", icon: "wallet" },
];

function Icon({ name }: { name: string }) {
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
    case "truck":
      return (
        <svg viewBox="0 0 24 24" className={c} {...common}>
          <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7" />
          <circle cx="5.5" cy="18.5" r="1.5" />
          <circle cx="18.5" cy="18.5" r="1.5" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={c} {...common}>
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <path d="M2 10h20M16 15h2" />
        </svg>
      );
  }
}

export default function SupplierShell({
  children,
  name,
  company,
}: {
  children: React.ReactNode;
  name: string;
  company: string;
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
            HALF<span className="text-gold">·</span>ZIPPER
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">Supplier Portal</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((n) => {
            const active =
              n.href === "/supplier"
                ? pathname === "/supplier"
                : pathname.startsWith(n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm transition ${
                  active
                    ? "bg-gold/15 text-amber-700 font-medium"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon name={n.icon} />
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <div className="px-3 py-2 mb-2">
            <p className="text-xs text-slate-400">Signed in as</p>
            <p className="text-sm text-slate-900 truncate">{company || name}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/supplier/login" })}
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
            HALF<span className="text-gold">·</span>ZIPPER
          </span>
          <span className="w-9" />
        </header>

        <main className="flex-1 p-4 sm:p-5 md:p-8 max-w-[1200px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
