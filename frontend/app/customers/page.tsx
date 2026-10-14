"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/lib/auth";
import { apiErrorMessage, listAll, type Customer } from "@/lib/api";
import {
  ErrorBanner,
  PageTitle,
  Spinner,
  EmptyState,
  btnPrimary,
  listWrap,
  rowHover,
} from "@/components/ui";

export default function CustomersPage() {
  return (
    <RequireAuth>
      <CustomersBody />
    </RequireAuth>
  );
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-violet-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-orange-500",
  "bg-rose-500",
  "bg-teal-500",
];

function CustomersBody() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listAll<Customer>("/customers/")
      .then(setCustomers)
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const filtered = customers.filter((c) => {
    const name = (c.customer_display_name || `${c.first_name} ${c.last_name}`).toLowerCase();
    return name.includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="animate-fade-in">
      <PageTitle
        title="Customers"
        subtitle={`${customers.length} total customers`}
        action={
          <Link href="/customers/new" className={btnPrimary}>
            + Add Customer
          </Link>
        }
      />
      <ErrorBanner message={error} />

      {customers.length > 0 && (
        <div className="mb-4">
          <input
            type="search"
            placeholder="Search customers by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-[38px] w-full max-w-sm rounded-xl border border-[#e2e8f0] bg-white px-3 text-[13px] outline-none transition-all placeholder:text-[#94a3b8] focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        customers.length === 0 ? (
          <EmptyState
            icon="person"
            title="No customers yet"
            description="Add your first customer to get started."
            action={
              <Link href="/customers/new" className={btnPrimary}>
                Add Customer
              </Link>
            }
          />
        ) : (
          <EmptyState icon="search" title="No results found" description="Try a different search term." />
        )
      ) : (
        <div className={listWrap}>
          {/* Header */}
          <div className="hidden grid-cols-3 gap-4 bg-[#f8fafc] px-4 py-2.5 sm:grid">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Name</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Email</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Phone</span>
          </div>
          <ul>
            {filtered.map((c, idx) => {
              const name = c.customer_display_name || `${c.first_name} ${c.last_name}`;
              const color = AVATAR_COLORS[idx % AVATAR_COLORS.length];
              return (
                <li key={c.id}>
                  <Link
                    href={`/customers/${c.id}`}
                    className={`flex items-center gap-3 px-4 py-3.5 sm:grid sm:grid-cols-3 sm:gap-4 ${rowHover}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${color} text-[11px] font-bold text-white`}
                      >
                        {getInitials(name)}
                      </div>
                      <span className="font-medium text-[#0f172a]">{name}</span>
                    </div>
                    <span className="hidden text-[13px] text-[#64748b] sm:block">{c.email}</span>
                    <span className="hidden text-[13px] text-[#64748b] sm:block">{c.phone}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
