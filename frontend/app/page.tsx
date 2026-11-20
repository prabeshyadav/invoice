"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequireAuth, useAuth } from "@/lib/auth";
import {
  apiErrorMessage,
  apiFetch,
  displayStatus,
  formatDate,
  formatMoney,
  type Invoice,
} from "@/lib/api";
import Icon from "@/components/Icon";
import {
  Card,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Spinner,
  StatCard,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  td,
  th,
  trLink,
} from "@/components/ui";

export default function Dashboard() {
  return (
    <RequireAuth>
      <DashboardBody />
    </RequireAuth>
  );
}

const BAR_COLORS: Record<string, string> = {
  paid: "bg-emerald-500",
  sent: "bg-blue-500",
  draft: "bg-slate-300",
  overdue: "bg-red-500",
};

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

type DashboardInvoice = Pick<
  Invoice,
  "id" | "customer_name" | "customer_display_name" | "invoice_number" | "invoice_date" | "due_date" | "subject" | "status" | "total"
>;

/* GET /api/dashboard/: totals are computed server-side; money values are "12.50" strings. */
interface DashboardData {
  invoice_count: number;
  customer_count: number;
  totals: { billed: string; collected: string; outstanding: string; overdue: string };
  by_status: Record<string, { count: number; amount: string }>;
  recent: DashboardInvoice[];
  upcoming: DashboardInvoice[];
}

function DashboardBody() {
  const { username } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<DashboardData>("/dashboard/")
      .then(setData)
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <ErrorBanner message={error ?? "Could not load the dashboard."} />;

  const invoiceCount = data.invoice_count;
  const paidCount = data.by_status.paid?.count ?? 0;
  const overdueCount = data.by_status.overdue?.count ?? 0;
  const unpaidCount = invoiceCount - paidCount;
  const total = Number(data.totals.billed);

  const breakdown = ["paid", "sent", "draft", "overdue"].map((s) => ({
    status: s,
    count: data.by_status[s]?.count ?? 0,
    amount: Number(data.by_status[s]?.amount ?? 0),
  }));

  const upcoming = data.upcoming;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${username}`}
        subtitle="Here's an overview of your billing."
        actions={
          <>
            <Link href="/customers/new" className={btnSecondary}>
              <Icon name="person_add" className="text-[18px]" />
              Add customer
            </Link>
            <Link href="/invoices/new" className={btnPrimary}>
              <Icon name="add" className="text-[18px]" />
              New invoice
            </Link>
          </>
        }
      />
      <ErrorBanner message={error} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total billed"
          value={formatMoney(total)}
          icon="payments"
          hint={`${invoiceCount} invoice${invoiceCount === 1 ? "" : "s"}`}
          href="/invoices"
        />
        <StatCard
          label="Collected"
          value={formatMoney(data.totals.collected)}
          icon="check_circle"
          tone="success"
          hint={`${paidCount} paid`}
        />
        <StatCard
          label="Outstanding"
          value={formatMoney(data.totals.outstanding)}
          icon="schedule"
          tone="warning"
          hint={`${unpaidCount} unpaid`}
        />
        <StatCard
          label="Overdue"
          value={formatMoney(data.totals.overdue)}
          icon="warning"
          tone="danger"
          hint={`${overdueCount} past due · ${data.customer_count} customers`}
        />
      </div>

      {invoiceCount === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon="receipt_long"
            title="No invoices yet"
            description="Add a customer, then create your first invoice to start tracking payments."
            action={
              <Link href="/invoices/new" className={btnPrimary}>
                Create invoice
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          <Card className="mt-6" title="Invoice status" description="Share of billed amount by status">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-line-soft">
              {breakdown.map(
                (b) =>
                  b.amount > 0 && (
                    <div
                      key={b.status}
                      className={BAR_COLORS[b.status]}
                      style={{ width: `${(b.amount / (total || 1)) * 100}%` }}
                      title={`${b.status}: ${formatMoney(b.amount)}`}
                    />
                  )
              )}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {breakdown.map((b) => (
                <div key={b.status}>
                  <dt className="flex items-center gap-2 text-[13px] capitalize text-muted">
                    <span className={`h-2 w-2 rounded-full ${BAR_COLORS[b.status]}`} />
                    {b.status}
                  </dt>
                  <dd className="tabular mt-1 text-[15px] font-semibold text-ink">
                    {formatMoney(b.amount)}
                    <span className="ml-1.5 text-xs font-normal text-faint">({b.count})</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Card
              className="xl:col-span-2"
              padded={false}
              title="Recent invoices"
              actions={
                <Link href="/invoices" className="text-[13px] font-medium text-accent hover:underline">
                  View all
                </Link>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr>
                      <th className={th}>Invoice</th>
                      <th className={th}>Customer</th>
                      <th className={th}>Status</th>
                      <th className={`${th} text-right`}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((inv) => (
                      <tr key={inv.id} className={trLink} onClick={() => router.push(`/invoices/${inv.id}`)}>
                        <td className={td}>
                          <Link href={`/invoices/${inv.id}`} className="font-medium text-ink hover:text-accent">
                            {inv.invoice_number}
                          </Link>
                          <p className="text-xs text-muted">{formatDate(inv.invoice_date)}</p>
                        </td>
                        <td className={`${td} text-ink-2`}>{inv.customer_display_name}</td>
                        <td className={td}>
                          <StatusBadge status={displayStatus(inv)} />
                        </td>
                        <td className={`${td} tabular text-right font-medium`}>
                          {formatMoney(inv.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Upcoming due" description="Unpaid invoices by due date" padded={false}>
              {upcoming.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted">Nothing due. Nice work!</p>
              ) : (
                <ul>
                  {upcoming.map((inv) => (
                    <li key={inv.id} className="border-t border-line-soft first:border-t-0">
                      <Link
                        href={`/invoices/${inv.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3 transition hover:bg-slate-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">{inv.customer_display_name}</p>
                          <p className="text-xs text-muted">
                            {inv.invoice_number} · due {formatDate(inv.due_date)}
                          </p>
                        </div>
                        <span className="tabular text-sm font-medium">
                          {formatMoney(inv.total)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
