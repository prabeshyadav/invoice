"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import Icon from "./Icon";

const LINKS = [
  { href: "/customers", label: "Customers", icon: "person" },
  { href: "/items", label: "Items", icon: "work" },
  { href: "/invoices", label: "Invoices", icon: "task" },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const { ready, username, logout } = useAuth();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!ready || !username) return <>{children}</>;

  const initials = username.slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex w-[220px] flex-col bg-sidebar transition-transform duration-300 ease-in-out md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:block`}
      >
        {/* Logo */}
        <div className="flex h-[60px] items-center gap-3 border-b border-white/10 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <Icon name="lab_profile" className="text-white text-[18px]" />
          </div>
          <span className="text-[15px] font-semibold tracking-wide text-white">
            InvoicePro
          </span>
        </div>

        {/* Nav */}
        <nav className="flex flex-col gap-1 p-3 pt-4">
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/30">
            Menu
          </p>
          {LINKS.map((l) => {
            const active =
              pathname === l.href || pathname.startsWith(`${l.href}/`);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
                  active
                    ? "bg-accent text-white shadow-lg shadow-accent/30"
                    : "text-white/60 hover:bg-white/8 hover:text-white"
                }`}
              >
                <Icon
                  name={l.icon}
                  className={`text-[18px] transition-colors ${
                    active ? "text-white" : "text-white/50 group-hover:text-white"
                  }`}
                />
                {l.label}
                {active && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white/80" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="mt-auto border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/80 text-[11px] font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-medium text-white/90">
                {username}
              </p>
              <p className="text-[10px] text-white/40">Administrator</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Topbar */}
      <header
        className={`fixed inset-x-0 top-0 z-[4] h-[60px] transition-shadow duration-200 md:left-[220px] ${
          scrolled ? "shadow-sm" : ""
        } border-b border-[#e2e8f0] bg-white`}
      >
        <div className="flex h-full items-center gap-3 px-4 md:px-6">
          {/* Mobile hamburger */}
          <button
            type="button"
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e2e8f0] text-[#64748b] transition hover:bg-[#f1f5f9] md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Icon name="menu" className="text-[20px]" />
          </button>

          {/* Search */}
          <div className="flex h-[36px] w-full max-w-xs items-center gap-2 rounded-xl border border-[#e2e8f0] bg-[#f8fafc] px-3 transition-all focus-within:border-accent focus-within:bg-white focus-within:shadow-sm">
            <Icon name="search" className="shrink-0 text-[16px] text-[#94a3b8]" />
            <input
              className="w-full bg-transparent text-[13px] text-[#0f172a] outline-none placeholder:text-[#94a3b8]"
              placeholder="Search…"
            />
            <kbd className="hidden shrink-0 rounded border border-[#e2e8f0] px-1 text-[10px] text-[#94a3b8] sm:block">
              /
            </kbd>
          </div>

          {/* Right icons */}
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/invoices/new"
              className="hidden items-center gap-1.5 rounded-xl bg-accent px-3 py-1.5 text-[12px] font-medium text-white shadow-sm hover:bg-accent-dark sm:flex"
            >
              <Icon name="add" className="text-[16px]" />
              New Invoice
            </Link>
            <button
              type="button"
              aria-label="Notifications"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#64748b] transition hover:bg-[#f1f5f9]"
            >
              <Icon name="notifications" className="text-[20px]" />
            </button>
            <button
              type="button"
              aria-label="Settings"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#64748b] transition hover:bg-[#f1f5f9]"
            >
              <Icon name="settings" className="text-[20px]" />
            </button>
            <span className="mx-1 h-5 border-l border-[#e2e8f0]" />
            <button
              type="button"
              onClick={logout}
              title="Log out"
              className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium text-[#64748b] transition hover:bg-red-50 hover:text-red-600"
            >
              <Icon name="logout" className="text-[18px]" />
              <span className="hidden sm:block">Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="min-h-screen px-4 pb-16 pt-[76px] md:ml-[220px] md:px-8 animate-fade-in">
        {children}
      </main>
    </div>
  );
}
