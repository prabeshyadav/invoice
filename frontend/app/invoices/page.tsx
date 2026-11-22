"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
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
  btnSecondary,
  td,
  th,
  trLink,
} from "@/components/ui";

const FILTERS = ["all", "draft", "sent", "partially_paid", "paid", "overdue"];

export default function InvoicesPage() {
  return (
    <RequireAuth>
      <InvoicesBody />
    </RequireAuth>
  );
}

function InvoicesBody() {
  const router = useRouter();
  const toast = useToast();
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
          <div className="flex items-center gap-2">
            <a
              href="/api/invoices/export_csv/"
              download="invoices.csv"
              className={btnSecondary}
              title="Download invoices spreadsheet"
            >
              <Icon name="download" className="text-[18px]" />
              Export CSV
            </a>
            <Link href="/invoices/new" className={btnPrimary}>
              <Icon name="add" className="text-[18px]" />
              New invoice
            </Link>
          </div>
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
                {s.replace("_", " ")}
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
            <EmptyState
              icon="search_off"
              title="No matching invoices"
              description="Try a different filter or search term."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                  className={btnSecondary}
                >
                  Reset filters
                </button>
              }
            />
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
                    <tr key={inv.id} className={`${trLink} group`} onClick={() => router.push(`/invoices/${inv.id}`)}>
                      <td className={td}>
                        <div className="flex items-center gap-1.5">
                          <Link
                            href={`/invoices/${inv.id}`}
                            className="font-semibold text-ink hover:text-accent"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {inv.invoice_number}
                          </Link>
                          <button
                            type="button"
                            title="Copy number"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(inv.invoice_number);
                              toast.success(`Copied ${inv.invoice_number}`);
                            }}
                            className="rounded-md p-0.5 text-faint opacity-0 transition group-hover:opacity-100 hover:bg-slate-100 hover:text-ink"
                          >
                            <Icon name="content_copy" className="text-[14px]" />
                          </button>
                        </div>
                        <p className="max-w-[220px] truncate text-xs text-muted">{inv.subject}</p>
                      </td>
                      <td className={`${td} text-ink-2`}>{inv.customer_display_name}</td>
                      <td className={`${td} text-muted`}>{formatDate(inv.invoice_date)}</td>
                      <td className={`${td} ${status === "overdue" ? "font-semibold text-rose-600" : "text-muted"}`}>
                        {formatDate(inv.due_date)}
                      </td>
                      <td className={td}>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <StatusBadge status={status} />
                          {inv.first_viewed_at && (
                            <span
                              className="inline-flex items-center gap-0.5 rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 border border-purple-200/50"
                              title={`Viewed by client on ${formatDate(inv.first_viewed_at)}`}
                            >
                              <Icon name="visibility" className="text-[12px]" />
                              Viewed
                            </span>
                          )}
                        </div>
                      </td>
                      <td className={`${td} tabular text-right`}>
                        {Number(inv.amount_paid) > 0 && Number(inv.balance_due) > 0 ? (
                          <div>
                            <span className="font-semibold text-ink">{formatMoney(inv.balance_due)}</span>
                            <span className="block text-[11px] text-muted">of {formatMoney(inv.total)}</span>
                          </div>
                        ) : (
                          <span className="font-medium text-ink">{formatMoney(inv.total)}</span>
                        )}
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
