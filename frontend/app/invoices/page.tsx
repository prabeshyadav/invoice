"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/lib/auth";
import {
  apiErrorMessage,
  displayStatus,
  formatDate,
  formatMoney,
  listAll,
  type Invoice,
} from "@/lib/api";
import Icon from "@/components/Icon";
import {
  Card,
  EmptyState,
  ErrorBanner,
  PageHeader,
  SearchInput,
  Spinner,
  StatusBadge,
  btnPrimary,
  td,
  th,
  trLink,
} from "@/components/ui";

const FILTERS = ["all", "draft", "sent", "paid", "overdue"];

export default function InvoicesPage() {
  return (
    <RequireAuth>
      <InvoicesBody />
    </RequireAuth>
  );
}

function InvoicesBody() {
  const router = useRouter();
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

  const q = search.trim().toLowerCase();
  const count = (s: string) => (s === "all" ? invoices.length : invoices.filter((i) => displayStatus(i) === s).length);
  const filtered = invoices.filter(
    (inv) =>
      (filter === "all" || displayStatus(inv) === filter) &&
      (!q ||
        inv.invoice_number.toLowerCase().includes(q) ||
        inv.subject.toLowerCase().includes(q) ||
        inv.customer_display_name?.toLowerCase().includes(q))
  );

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle="Create, track and send invoices to your customers."
        actions={
          <Link href="/invoices/new" className={btnPrimary}>
            <Icon name="add" className="text-[18px]" />
            New invoice
          </Link>
        }
      />
      <ErrorBanner message={error} />

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-line-soft p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-1 overflow-x-auto rounded-lg bg-line-soft p-1" role="tablist">
            {FILTERS.map((s) => (
              <button
                key={s}
                type="button"
                role="tab"
                aria-selected={filter === s}
                onClick={() => setFilter(s)}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-[13px] font-medium capitalize transition ${
                  filter === s ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                }`}
              >
                {s}
                <span className={`tabular rounded-full px-1.5 text-[11px] ${filter === s ? "bg-accent-soft text-accent" : "bg-white/70 text-faint"}`}>
                  {count(s)}
                </span>
              </button>
            ))}
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search number, customer, subject…" />
        </div>

        {filtered.length === 0 ? (
          invoices.length === 0 ? (
            <EmptyState
              icon="receipt_long"
              title="No invoices yet"
              description="Create your first invoice to start billing customers."
              action={
                <Link href="/invoices/new" className={btnPrimary}>
                  Create invoice
                </Link>
              }
            />
          ) : (
            <EmptyState icon="search_off" title="No matching invoices" description="Try a different filter or search term." />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className={th}>Invoice</th>
                  <th className={th}>Customer</th>
                  <th className={th}>Issued</th>
                  <th className={th}>Due</th>
                  <th className={th}>Status</th>
                  <th className={`${th} text-right`}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const status = displayStatus(inv);
                  return (
                    <tr key={inv.id} className={trLink} onClick={() => router.push(`/invoices/${inv.id}`)}>
                      <td className={td}>
                        <Link href={`/invoices/${inv.id}`} className="font-medium text-ink hover:text-accent">
                          {inv.invoice_number}
                        </Link>
                        <p className="max-w-[220px] truncate text-xs text-muted">{inv.subject}</p>
                      </td>
                      <td className={`${td} text-ink-2`}>{inv.customer_display_name}</td>
                      <td className={`${td} text-muted`}>{formatDate(inv.invoice_date)}</td>
                      <td className={`${td} ${status === "overdue" ? "font-medium text-danger" : "text-muted"}`}>
                        {formatDate(inv.due_date)}
                      </td>
                      <td className={td}>
                        <StatusBadge status={status} />
                      </td>
                      <td className={`${td} tabular text-right font-medium`}>
                        {formatMoney(inv.discounted_total_amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
