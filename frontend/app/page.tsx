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
import { MonthlyBarChart, PieChart } from "@/components/Charts";
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

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

type DashboardInvoice = Pick<
  Invoice,
  "id" | "customer_name" | "customer_display_name" | "invoice_number" | "invoice_date" | "due_date" | "subject" | "status" | "total"
>;

interface MonthlyTrendItem {
  month: string;
  year?: number;
  billed: string;
  collected: string;
}

/* GET /api/dashboard/: totals are computed server-side; money values are "12.50" strings. */
interface DashboardData {
  invoice_count: number;
  customer_count: number;
  totals: { billed: string; collected: string; outstanding: string; overdue: string };
  by_status: Record<string, { count: number; amount: string }>;
  monthly_trend?: MonthlyTrendItem[];
  recent: DashboardInvoice[];
  upcoming: DashboardInvoice[];
}

function DashboardBody() {
  const { username } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<"pie" | "donut">("pie");

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

  const statusColors: Record<string, string> = {
    paid: "#10b981",
    sent: "#3b82f6",
    partially_paid: "#f59e0b",
    draft: "#94a3b8",
    overdue: "#f43f5e",
  };

  const donutSegments = ["paid", "sent", "partially_paid", "draft", "overdue"]
    .map((s) => ({
      label: s === "partially_paid" ? "Partially paid" : s.charAt(0).toUpperCase() + s.slice(1),
      value: Number(data.by_status[s]?.amount ?? 0),
      count: data.by_status[s]?.count ?? 0,
      color: statusColors[s] || "#94a3b8",
    }))
    .filter((s) => s.value > 0 || (s.count ?? 0) > 0);

  const monthlyBarData = (data.monthly_trend ?? []).map((m) => ({
    month: m.month,
    year: m.year,
    billed: Number(m.billed),
    collected: Number(m.collected),
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
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card
              title="Invoice Status Breakdown"
              description="Interactive distribution by status (hover slices to inspect)"
              actions={
                <div className="flex items-center rounded-lg bg-line-soft p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setChartMode("pie")}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      chartMode === "pie"
                        ? "bg-white text-ink shadow-2xs"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    Pie
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode("donut")}
                    className={`rounded-md px-2.5 py-1 font-medium transition ${
                      chartMode === "donut"
                        ? "bg-white text-ink shadow-2xs"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    Donut
                  </button>
                </div>
              }
            >
              <PieChart
                segments={donutSegments}
                donut={chartMode === "donut"}
                size={190}
              />
            </Card>

            <Card
              title="Monthly Cash Flow"
              description="Invoiced vs Collected over the last 6 months"
            >
              <MonthlyBarChart data={monthlyBarData} />
            </Card>
          </div>

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
