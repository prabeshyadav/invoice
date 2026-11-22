"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import Icon from "./Icon";
import { Avatar } from "./ui";

const LINKS = [
  { href: "/", label: "Dashboard", icon: "space_dashboard" },
  { href: "/invoices", label: "Invoices", icon: "receipt_long" },
  { href: "/customers", label: "Customers", icon: "group" },
  { href: "/items", label: "Items", icon: "inventory_2" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-sm shadow-indigo-500/30">
        <Icon name="receipt_long" className="text-[18px]" />
      </span>
      {!compact && <span className="text-[15px] font-semibold tracking-tight text-ink">InvoicePro</span>}
    </span>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const { ready, username, logout } = useAuth();
  const pathname = usePathname();
  const [openPath, setOpenPath] = useState<string | null>(null);
  // The mobile drawer closes itself on navigation: it is "open" only for the path it was opened on.
  const sidebarOpen = openPath === pathname;

  if (!ready || !username) return <>{children}</>;

  return (
    <div className="min-h-screen">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-[1px] lg:hidden"
          onClick={() => setOpenPath(null)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`no-print fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-white transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/">
            <Logo />
          </Link>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpenPath(null)}
            className="rounded-md p-1 text-muted hover:bg-slate-100 lg:hidden"
          >
            <Icon name="close" />
          </button>
        </div>

        <div className="px-4 pb-2 pt-2">
          <Link
            href="/invoices/new"
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-accent text-sm font-medium text-white shadow-sm shadow-accent/20 transition hover:bg-accent-dark"
          >
            <Icon name="add" className="text-[18px]" />
            New invoice
          </Link>
        </div>

        <nav className="flex flex-col gap-0.5 px-3 py-4" aria-label="Main">
          {LINKS.map((l) => {
            const active = isActive(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-slate-100 hover:text-ink"
                }`}
              >
                <Icon name={l.icon} className={`text-[20px] ${active ? "text-accent" : "text-faint"}`} />
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-line p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <Avatar name={username} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{username}</p>
              <p className="text-xs text-muted">Signed in</p>
            </div>
            <button
              type="button"
              onClick={logout}
              title="Log out"
              aria-label="Log out"
              className="rounded-md p-1.5 text-muted transition hover:bg-red-50 hover:text-danger"
            >
              <Icon name="logout" className="text-[18px]" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-white/90 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpenPath(pathname)}
          className="rounded-md p-1.5 text-ink-2 hover:bg-slate-100"
        >
          <Icon name="menu" />
        </button>
        <Logo />
      </header>

      <main className="lg:pl-64 print:pl-0">
        <div key={pathname} className="mx-auto max-w-6xl animate-fade-in px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>
    </div>
  );
}
