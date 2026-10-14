"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/lib/auth";
import { apiErrorMessage, apiFetch, type Invoice } from "@/lib/api";
import {
  ErrorBanner,
  PageTitle,
  Spinner,
  StatCard,
  EmptyState,
  listWrap,
  rowHover,
  btnPrimary,
} from "@/components/ui";

export default function Dashboard() {
  return (
    <RequireAuth>
      <DashboardBody />
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
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {status}
    </span>
  );
}

function DashboardBody() {
  const [counts, setCounts] = useState({ customers: 0, invoices: 0 });
  const [recent, setRecent] = useState<Invoice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [cust, inv] = await Promise.all([
          apiFetch<{ count: number }>("/customers/"),
          apiFetch<{ count: number; results: Invoice[] }>("/invoices/"),
        ]);
        setCounts({ customers: cust.count, invoices: inv.count });
        setRecent(inv.results.slice(0, 5));
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Spinner />;

  return (
    <div className="animate-fade-in">
      <PageTitle
        title="Dashboard"
        subtitle="Welcome back! Here's what's happening."
      />
      <ErrorBanner message={error} />

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Total Customers"
          value={counts.customers}
          icon="person"
          href="/customers"
        />
        <StatCard
          label="Total Invoices"
          value={counts.invoices}
          icon="task"
          href="/invoices"
        />
        <StatCard
          label="Pending Review"
          value="—"
          icon="schedule"
        />
      </div>

      {/* Recent invoices */}
      <div className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[14px] font-semibold text-[#0f172a]">
            Recent Invoices
          </h2>
          <Link
            href="/invoices"
            className="text-[12px] font-medium text-accent hover:underline"
          >
            View all →
          </Link>
        </div>

        {recent.length === 0 ? (
          <EmptyState
            icon="task"
            title="No invoices yet"
            description="Create your first invoice to get started."
            action={
              <Link href="/invoices/new" className={btnPrimary}>
                Create Invoice
              </Link>
            }
          />
        ) : (
          <div className={listWrap}>
            {/* Table header */}
            <div className="hidden grid-cols-4 gap-4 bg-[#f8fafc] px-4 py-2.5 sm:grid">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                Invoice #
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                Subject
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                Status
              </span>
              <span className="text-right text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">
                Amount
              </span>
            </div>
            <ul>
              {recent.map((inv) => (
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
    </div>
  );
}
