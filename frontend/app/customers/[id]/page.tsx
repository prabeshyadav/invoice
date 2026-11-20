"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/lib/auth";
import {
  apiErrorMessage,
  apiFetch,
  customerName,
  displayStatus,
  formatDate,
  formatMoney,
  listAll,
  type Customer,
  type Invoice,
} from "@/lib/api";
import CustomerForm, { type CustomerPayload } from "@/components/CustomerForm";
import Icon from "@/components/Icon";
import {
  Avatar,
  Card,
  EmptyState,
  ErrorBanner,
  PageHeader,
  Spinner,
  StatusBadge,
  btnDanger,
  btnPrimary,
  btnSecondary,
  card,
  td,
  th,
  trLink,
} from "@/components/ui";

export default function CustomerDetailPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<Spinner />}>
        <CustomerDetailBody />
      </Suspense>
    </RequireAuth>
  );
}

function InfoRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5">
      <Icon name={icon} className="mt-0.5 text-[18px] text-faint" />
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="break-words text-sm text-ink">{children || "—"}</dd>
      </div>
    </div>
  );
}

function CustomerDetailBody() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([apiFetch<Customer>(`/customers/${id}/`), listAll<Invoice>(`/invoices/?customer=${id}`)])
      .then(([c, inv]) => {
        setCustomer(c);
        setInvoices(inv);
      })
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [id]);

  async function onSave(payload: CustomerPayload) {
    setError(null);
    setBusy(true);
    try {
      setCustomer(await apiFetch<Customer>(`/customers/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }));
      setEditing(false);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    const n = invoices.length;
    if (!confirm(`Delete this customer${n ? ` and their ${n} invoice${n === 1 ? "" : "s"}` : ""}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await apiFetch(`/customers/${id}/`, { method: "DELETE" });
      router.replace("/customers");
    } catch (e) {
      setError(apiErrorMessage(e));
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;
  if (!customer) return <ErrorBanner message={error ?? "Customer not found."} />;

  const name = customerName(customer);
  const total = invoices.reduce((s, i) => s + Number(i.discounted_total_amount), 0);
  const outstanding = invoices
    .filter((i) => i.status !== "paid")
    .reduce((s, i) => s + Number(i.discounted_total_amount), 0);

  if (editing) {
    return (
      <div className="max-w-3xl">
        <PageHeader back={{ href: `/customers/${id}`, label: name }} title="Edit customer" />
        <ErrorBanner message={error} />
        <CustomerForm initial={customer} onSubmit={onSave} busy={busy} submitLabel="Save changes" onCancel={() => setEditing(false)} />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        back={{ href: "/customers", label: "Customers" }}
        title={name}
        actions={
          <>
            <button type="button" onClick={() => setEditing(true)} className={btnSecondary}>
              <Icon name="edit" className="text-[18px]" />
              Edit
            </button>
            <Link href={`/invoices/new?customer=${id}`} className={btnPrimary}>
              <Icon name="add" className="text-[18px]" />
              New invoice
            </Link>
          </>
        }
      />
      <ErrorBanner message={error} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-6">
          <div className={`${card} p-5`}>
            <div className="flex items-center gap-4">
              <Avatar name={name} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-ink">
                  {customer.primary_contact} {customer.first_name} {customer.last_name}
                </p>
                <p className="text-sm capitalize text-muted">{customer.customer_type || "Customer"}</p>
              </div>
            </div>
            <dl className="mt-4 divide-y divide-line-soft border-t border-line-soft">
              <InfoRow icon="mail" label="Email">
                <a href={`mailto:${customer.email}`} className="text-accent hover:underline">
                  {customer.email}
                </a>
              </InfoRow>
              <InfoRow icon="call" label="Phone / Mobile">
                {[customer.phone, customer.mobile].filter(Boolean).join(" · ")}
              </InfoRow>
              <InfoRow icon="apartment" label="Company">{customer.company_name}</InfoRow>
              <InfoRow icon="language" label="Website">{customer.website}</InfoRow>
              <InfoRow icon="payments" label="Currency / Language">
                {[customer.currency, customer.Portal_Language].filter(Boolean).join(" · ")}
              </InfoRow>
            </dl>
          </div>
          <button type="button" onClick={onDelete} disabled={busy} className={`${btnDanger} w-full`}>
            <Icon name="delete" className="text-[18px]" />
            Delete customer
          </button>
        </aside>

        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {[
              ["Invoices", String(invoices.length)],
              ["Total billed", formatMoney(total)],
              ["Outstanding", formatMoney(outstanding)],
            ].map(([label, value]) => (
              <div key={label} className={`${card} p-4`}>
                <p className="text-xs text-muted">{label}</p>
                <p className="tabular mt-1 truncate text-lg font-semibold text-ink">{value}</p>
              </div>
            ))}
          </div>

          <Card title="Invoices" padded={false}>
            {invoices.length === 0 ? (
              <EmptyState
                icon="receipt_long"
                title="No invoices yet"
                description={`Create the first invoice for ${name}.`}
                action={
                  <Link href={`/invoices/new?customer=${id}`} className={btnPrimary}>
                    New invoice
                  </Link>
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead>
                    <tr>
                      <th className={th}>Invoice</th>
                      <th className={th}>Due</th>
                      <th className={th}>Status</th>
                      <th className={`${th} text-right`}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => (
                      <tr key={inv.id} className={trLink} onClick={() => router.push(`/invoices/${inv.id}`)}>
                        <td className={td}>
                          <Link href={`/invoices/${inv.id}`} className="font-medium text-ink hover:text-accent">
                            {inv.invoice_number}
                          </Link>
                          <p className="max-w-[240px] truncate text-xs text-muted">{inv.subject}</p>
                        </td>
                        <td className={`${td} text-muted`}>{formatDate(inv.due_date)}</td>
                        <td className={td}>
                          <StatusBadge status={displayStatus(inv)} />
                        </td>
                        <td className={`${td} tabular text-right font-medium`}>
                          {formatMoney(inv.discounted_total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
