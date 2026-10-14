"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/lib/auth";
import { apiErrorMessage, listAll, type Invoice } from "@/lib/api";
import {
  ErrorBanner,
  PageTitle,
  Spinner,
  EmptyState,
  btnPrimary,
  listWrap,
  rowHover,
} from "@/components/ui";

export default function InvoicesPage() {
  return (
    <RequireAuth>
      <InvoicesBody />
    </RequireAuth>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "badge-paid",
    sent: "badge-sent",
    draft: "badge-draft",
    overdue: "badge-overdue",
  };
  const cls = map[status] ?? "badge-draft";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cls}`}
    >
      {status}
    </span>
  );
}

function InvoicesBody() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    listAll<Invoice>("/invoices/")
      .then(setInvoices)
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const statuses = ["all", ...Array.from(new Set(invoices.map((i) => i.status)))];

  const filtered = invoices.filter((inv) => {
    const matchStatus = filter === "all" || inv.status === filter;
    const matchSearch =
      inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      inv.subject?.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <div className="animate-fade-in">
      <PageTitle
        title="Invoices"
        subtitle={`${invoices.length} total invoices`}
        action={
          <Link href="/invoices/new" className={btnPrimary}>
            + New Invoice
          </Link>
        }
      />
      <ErrorBanner message={error} />

      {invoices.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {/* Search */}
          <input
            type="search"
            placeholder="Search invoices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-[38px] w-full max-w-[220px] rounded-xl border border-[#e2e8f0] bg-white px-3 text-[13px] outline-none transition-all placeholder:text-[#94a3b8] focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
          />
          {/* Status tabs */}
          <div className="flex flex-wrap gap-1.5">
            {statuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFilter(s)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium capitalize transition-all ${
                  filter === s
                    ? "bg-accent text-white shadow-sm"
                    : "border border-[#e2e8f0] bg-white text-[#64748b] hover:border-[#cbd5e1] hover:text-[#0f172a]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        invoices.length === 0 ? (
          <EmptyState
            icon="task"
            title="No invoices yet"
            description="Create your first invoice to start billing customers."
            action={
              <Link href="/invoices/new" className={btnPrimary}>
                Create Invoice
              </Link>
            }
          />
        ) : (
          <EmptyState icon="search" title="No results" description="Try adjusting your filters." />
        )
      ) : (
        <div className={listWrap}>
          {/* Header */}
          <div className="hidden grid-cols-4 gap-4 bg-[#f8fafc] px-4 py-2.5 sm:grid">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Invoice #</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Subject</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Status</span>
            <span className="text-right text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Amount</span>
          </div>
          <ul>
            {filtered.map((inv) => (
              <li key={inv.id}>
                <Link
                  href={`/invoices/${inv.id}`}
                  className={`grid grid-cols-2 gap-2 px-4 py-3.5 sm:grid-cols-4 sm:gap-4 ${rowHover}`}
                >
                  <span className="font-semibold text-accent">
                    {inv.invoice_number}
                  </span>
                  <span className="truncate text-[#475569]">{inv.subject}</span>
                  <span className="hidden sm:block">
                    <StatusBadge status={inv.status} />
                  </span>
                  <span className="text-right font-medium text-[#0f172a]">
                    {inv.discounted_total_amount}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
