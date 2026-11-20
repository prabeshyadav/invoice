"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/lib/auth";
import {
  DISCOUNT_PERCENT,
  INVOICE_STATUSES,
  apiErrorMessage,
  apiFetch,
  apiFetchRaw,
  displayStatus,
  formatDate,
  formatMoney,
  type Customer,
  type Invoice,
} from "@/lib/api";
import Icon from "@/components/Icon";
import { Logo } from "@/components/AppShell";
import {
  Card,
  ErrorBanner,
  Field,
  PageHeader,
  Spinner,
  StatusBadge,
  SuccessBanner,
  btnDanger,
  btnPrimary,
  btnSecondary,
  card,
  inputCls,
  textareaCls,
} from "@/components/ui";

export default function InvoiceDetailPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<Spinner />}>
        <InvoiceDetailBody />
      </Suspense>
    </RequireAuth>
  );
}

function InvoiceDetailBody() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mail, setMail] = useState({ to: "", subject: "", message: "" });

  useEffect(() => {
    (async () => {
      try {
        const inv = await apiFetch<Invoice>(`/invoices/${id}/`);
        setInvoice(inv);
        setMail({
          to: "",
          subject: `Invoice ${inv.invoice_number}`,
          message: `Please find attached invoice ${inv.invoice_number}, due on ${formatDate(inv.due_date)}.`,
        });
        setCustomer(await apiFetch<Customer>(`/customers/${inv.customer_name}/`));
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function run(label: string, fn: () => Promise<void>) {
    setError(null);
    setNotice(null);
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const downloadPdf = () =>
    run("pdf", async () => {
      const res = await apiFetchRaw(`/invoices/${id}/pdf/`);
      if (!res.ok) throw new Error(`PDF generation failed (${res.status}).`);
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoice?.invoice_number ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    });

  const setStatus = (status: string) =>
    run("status", async () => {
      const updated = await apiFetch<Invoice>(`/invoices/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setInvoice(updated);
      setNotice(`Marked as ${status}.`);
    });

  const sendEmail = (e: FormEvent) => {
    e.preventDefault();
    run("email", async () => {
      const body = Object.fromEntries(
        Object.entries(mail)
          .map(([k, v]) => [k, v.trim()])
          .filter(([, v]) => v)
      );
      const data = await apiFetch<{ detail: string }>(`/invoices/${id}/send_email/`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setNotice(data.detail);
    });
  };

  const onDelete = () => {
    if (!confirm(`Delete invoice ${invoice?.invoice_number}? This cannot be undone.`)) return;
    run("delete", async () => {
      await apiFetch(`/invoices/${id}/`, { method: "DELETE" });
      router.replace("/invoices");
    });
  };

  if (loading) return <Spinner />;
  if (!invoice) return <ErrorBanner message={error ?? "Invoice not found."} />;

  const status = displayStatus(invoice);

  return (
    <>
      <div className="no-print">
        <PageHeader
          back={{ href: "/invoices", label: "Invoices" }}
          title={
            <span className="flex items-center gap-3">
              {invoice.invoice_number}
              <StatusBadge status={status} />
            </span>
          }
          subtitle={invoice.subject}
          actions={
            <>
              <Link href={`/invoices/${id}/edit`} className={btnSecondary}>
                <Icon name="edit" className="text-[18px]" />
                Edit
              </Link>
              <button type="button" onClick={() => window.print()} className={btnSecondary}>
                <Icon name="print" className="text-[18px]" />
                Print
              </button>
              <button type="button" onClick={downloadPdf} disabled={!!busy} className={btnPrimary}>
                <Icon name="download" className="text-[18px]" />
                {busy === "pdf" ? "Preparing…" : "Download PDF"}
              </button>
            </>
          }
        />
        <ErrorBanner message={error} />
        <SuccessBanner message={notice} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        {/* Document preview */}
        <article className={`${card} p-6 sm:p-10 print:border-0 print:shadow-none`}>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <Logo />
            <div className="text-right">
              <p className="text-2xl font-semibold tracking-tight text-ink">INVOICE</p>
              <p className="text-sm text-muted">{invoice.invoice_number}</p>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-faint">Bill to</p>
              <p className="mt-1.5 font-semibold text-ink">{invoice.customer_display_name}</p>
              {customer && (
                <div className="mt-0.5 space-y-0.5 text-sm text-muted">
                  {customer.company_name && customer.company_name !== invoice.customer_display_name && (
                    <p>{customer.company_name}</p>
                  )}
                  <p>{customer.email}</p>
                  <p>{customer.phone}</p>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-faint">Issued</p>
              <p className="mt-1.5 text-sm text-ink">{formatDate(invoice.invoice_date)}</p>
              <p className="mt-3 text-xs font-medium uppercase tracking-wide text-faint">Due</p>
              <p className={`mt-1.5 text-sm ${status === "overdue" ? "font-medium text-danger" : "text-ink"}`}>
                {formatDate(invoice.due_date)}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-medium uppercase tracking-wide text-faint">Amount due</p>
              <p className="tabular mt-1.5 text-2xl font-semibold text-ink">
                {formatMoney(invoice.discounted_total_amount)}
              </p>
              {customer && <p className="text-xs text-muted">{customer.currency}</p>}
            </div>
          </div>

          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-faint">
                  <th className="pb-2 font-medium">Description</th>
                  <th className="pb-2 text-right font-medium">Qty</th>
                  <th className="pb-2 text-right font-medium">Rate</th>
                  <th className="pb-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {invoice.line_items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-muted">
                      No line items.
                    </td>
                  </tr>
                )}
                {invoice.line_items.map((l) => (
                  <tr key={l.id} className="border-b border-line-soft">
                    <td className="py-3 text-ink">{l.items_details}</td>
                    <td className="py-3 text-right text-ink-2">{l.quantity}</td>
                    <td className="py-3 text-right text-ink-2">{formatMoney(l.rate)}</td>
                    <td className="py-3 text-right font-medium text-ink">{formatMoney(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="tabular ml-auto mt-6 w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-ink-2">
              <dt>Subtotal</dt>
              <dd>{formatMoney(invoice.sub_total)}</dd>
            </div>
            <div className="flex justify-between text-ink-2">
              <dt>Discount ({DISCOUNT_PERCENT}%)</dt>
              <dd>−{formatMoney(invoice.discount_amount)}</dd>
            </div>
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold text-ink">
              <dt>Total</dt>
              <dd>{formatMoney(invoice.discounted_total_amount)}</dd>
            </div>
          </dl>
        </article>

        {/* Actions */}
        <aside className="no-print space-y-6">
          <Card title="Status">
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-line-soft p-1">
              {INVOICE_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!!busy}
                  onClick={() => s !== invoice.status && setStatus(s)}
                  className={`rounded-md py-1.5 text-[13px] font-medium capitalize transition ${
                    invoice.status === s ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {invoice.status !== "paid" && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => setStatus("paid")}
                className={`${btnSecondary} mt-3 w-full`}
              >
                <Icon name="check_circle" className="text-[18px] text-success" />
                Mark as paid
              </button>
            )}
          </Card>

          <Card title="Email invoice" description="Sends the PDF as an attachment.">
            <form onSubmit={sendEmail} className="space-y-3">
              <Field label="To" hint={customer ? `Defaults to ${customer.email}` : undefined}>
                <input
                  className={inputCls}
                  type="email"
                  placeholder={customer?.email ?? "customer@example.com"}
                  value={mail.to}
                  onChange={(e) => setMail((m) => ({ ...m, to: e.target.value }))}
                />
              </Field>
              <Field label="Subject">
                <input
                  className={inputCls}
                  value={mail.subject}
                  onChange={(e) => setMail((m) => ({ ...m, subject: e.target.value }))}
                />
              </Field>
              <Field label="Message">
                <textarea
                  className={textareaCls}
                  rows={3}
                  value={mail.message}
                  onChange={(e) => setMail((m) => ({ ...m, message: e.target.value }))}
                />
              </Field>
              <button type="submit" disabled={!!busy} className={`${btnPrimary} w-full`}>
                <Icon name="send" className="text-[18px]" />
                {busy === "email" ? "Sending…" : "Send email"}
              </button>
            </form>
          </Card>

          <button type="button" onClick={onDelete} disabled={!!busy} className={`${btnDanger} w-full`}>
            <Icon name="delete" className="text-[18px]" />
            Delete invoice
          </button>
        </aside>
      </div>
    </>
  );
}
