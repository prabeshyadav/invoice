"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  apiErrorMessage,
  apiFetch,
  apiFetchRaw,
  displayStatus,
  formatDate,
  formatMoney,
  formatPercent,
  type PublicInvoice,
} from "@/lib/api";
import Icon from "@/components/Icon";
import { Logo } from "@/components/AppShell";
import {
  Spinner,
  StatusBadge,
  btnPrimary,
  btnSecondary,
  card,
} from "@/components/ui";

export default function PublicInvoicePage() {
  const { token } = useParams<{ token: string }>();
  const [invoice, setInvoice] = useState<PublicInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const inv = await apiFetch<PublicInvoice>(`/public-invoices/${token}/`);
        setInvoice(inv);
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const downloadPdf = async () => {
    setDownloading(true);
    try {
      const res = await apiFetchRaw(`/public-invoices/${token}/pdf/`);
      if (!res.ok) throw new Error("PDF download failed.");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoice?.invoice_number ?? token}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(apiErrorMessage(e));
    } finally {
      setDownloading(false);
    }
  };

  if (loading) return <Spinner label="Loading invoice…" />;

  if (!invoice) {
    return (
      <div className="mx-auto max-w-lg py-20 px-4 text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Icon name="receipt_long" className="text-[24px]" />
        </div>
        <h1 className="text-xl font-semibold text-ink">Invoice not found</h1>
        <p className="mt-2 text-sm text-muted">
          {error || "This invoice link may be invalid or has expired. Please contact the issuer for an updated link."}
        </p>
      </div>
    );
  }

  const org = invoice.organization;
  const cust = invoice.customer;
  const status = displayStatus(invoice);

  return (
    <main className="min-h-screen bg-slate-50/60 py-8 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Public Header Bar */}
        <div className="no-print flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line bg-surface p-4 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-ink">
              Invoice from <strong className="text-ink">{org?.company_name || "InvoicePro"}</strong>
            </span>
            <StatusBadge status={status} />
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className={btnSecondary}
            >
              <Icon name="print" className="text-[18px]" />
              Print
            </button>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={downloading}
              className={btnPrimary}
            >
              <Icon name="download" className="text-[18px]" />
              {downloading ? "Preparing…" : "Download PDF"}
            </button>
          </div>
        </div>

        {/* Invoice Document */}
        <article className={`${card} p-6 sm:p-12 print:border-0 print:p-0 print:shadow-none`}>
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-6 pb-8 border-b border-line-soft">
            <div className="space-y-1">
              <Logo />
              {org?.company_name && (
                <p className="font-semibold text-ink pt-1.5">{org.company_name}</p>
              )}
              {org?.tax_id && (
                <p className="text-xs text-muted">PAN/VAT: {org.tax_id}</p>
              )}
              {(org?.email || org?.phone || org?.address) && (
                <div className="text-xs text-muted space-y-0.5">
                  {org.address && <p>{org.address}</p>}
                  <p>{[org.email, org.phone].filter(Boolean).join(" • ")}</p>
                </div>
              )}
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold tracking-tight text-ink">INVOICE</p>
              <p className="text-sm font-medium text-muted mt-1">{invoice.invoice_number}</p>
              <div className="mt-2 inline-block">
                <StatusBadge status={status} />
              </div>
            </div>
          </div>

          {/* Meta Grid */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-faint">Billed to</p>
              <p className="mt-1.5 font-semibold text-ink">{cust?.customer_display_name}</p>
              {cust && (
                <div className="mt-1 space-y-0.5 text-xs text-muted">
                  {cust.company_name && cust.company_name !== cust.customer_display_name && (
                    <p>{cust.company_name}</p>
                  )}
                  {cust.email && <p>{cust.email}</p>}
                  {cust.phone && <p>{cust.phone}</p>}
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-faint">Date Issued</p>
              <p className="mt-1.5 text-sm text-ink">{formatDate(invoice.invoice_date)}</p>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-faint">Date Due</p>
              <p className={`mt-1.5 text-sm ${status === "overdue" ? "font-semibold text-rose-600" : "text-ink"}`}>
                {formatDate(invoice.due_date)}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-faint">
                {Number(invoice.amount_paid) > 0 ? "Balance Due" : "Amount Due"}
              </p>
              <p className="tabular mt-1.5 text-3xl font-bold text-ink">
                {formatMoney(invoice.balance_due ?? invoice.total)}
              </p>
              {Number(invoice.amount_paid) > 0 && (
                <p className="mt-1 text-xs text-muted">
                  Total: {formatMoney(invoice.total)} · Paid: {formatMoney(invoice.amount_paid)}
                </p>
              )}
              {cust?.currency && <p className="text-xs text-muted mt-0.5">{cust.currency}</p>}
            </div>
          </div>

          {/* Line items table */}
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-faint">
                  <th className="pb-3 font-semibold">Description</th>
                  <th className="pb-3 text-right font-semibold">Qty</th>
                  <th className="pb-3 text-right font-semibold">Rate</th>
                  <th className="pb-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="tabular divide-y divide-line-soft">
                {invoice.line_items.map((l) => (
                  <tr key={l.id}>
                    <td className="py-3.5 text-ink">{l.items_details}</td>
                    <td className="py-3.5 text-right text-ink-2">{Number(l.quantity)}</td>
                    <td className="py-3.5 text-right text-ink-2">{formatMoney(l.rate)}</td>
                    <td className="py-3.5 text-right font-medium text-ink">{formatMoney(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Summary / Totals */}
          <dl className="tabular ml-auto mt-6 w-full max-w-xs space-y-2 text-sm">
            <div className="flex justify-between text-ink-2">
              <dt>Subtotal</dt>
              <dd>{formatMoney(invoice.sub_total)}</dd>
            </div>
            {Number(invoice.discount_percent) > 0 && (
              <div className="flex justify-between text-ink-2">
                <dt>Discount ({formatPercent(invoice.discount_percent)})</dt>
                <dd>−{formatMoney(invoice.discount_amount)}</dd>
              </div>
            )}
            {Number(invoice.tax_percent) > 0 && (
              <div className="flex justify-between text-ink-2">
                <dt>Tax ({formatPercent(invoice.tax_percent)})</dt>
                <dd>{formatMoney(invoice.tax_amount)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-line pt-3 text-base font-semibold text-ink">
              <dt>Total</dt>
              <dd>{formatMoney(invoice.total)}</dd>
            </div>
            {Number(invoice.amount_paid) > 0 && (
              <>
                <div className="flex justify-between text-emerald-700">
                  <dt>Amount Paid</dt>
                  <dd>−{formatMoney(invoice.amount_paid)}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2 text-lg font-bold text-ink">
                  <dt>Balance Due</dt>
                  <dd>{formatMoney(invoice.balance_due)}</dd>
                </div>
              </>
            )}
          </dl>

          {/* Bank & Payment Details */}
          {(invoice.notes || invoice.terms || org?.bank_details || org?.invoice_notes) && (
            <div className="mt-10 border-t border-line-soft pt-6 space-y-4">
              {invoice.notes && (
                <div>
                  <p className="font-semibold uppercase tracking-wider text-faint text-[10px]">
                    Invoice Notes
                  </p>
                  <p className="mt-1.5 text-xs text-muted whitespace-pre-line leading-relaxed">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <p className="font-semibold uppercase tracking-wider text-faint text-[10px]">
                    Terms &amp; Conditions
                  </p>
                  <p className="mt-1.5 text-xs text-muted whitespace-pre-line leading-relaxed">{invoice.terms}</p>
                </div>
              )}
              {org?.bank_details && (
                <div className="rounded-xl bg-slate-50 p-4 border border-line-soft text-xs">
                  <p className="font-semibold uppercase tracking-wider text-faint text-[10px]">
                    How to Pay / Bank Details
                  </p>
                  <p className="mt-2 whitespace-pre-line font-mono text-ink-2 text-xs leading-relaxed">
                    {org.bank_details}
                  </p>
                </div>
              )}
              {!invoice.notes && org?.invoice_notes && (
                <p className="text-xs text-muted italic">{org.invoice_notes}</p>
              )}
            </div>
          )}
        </article>

        {/* Public Footer */}
        <p className="no-print text-center text-xs text-muted pb-8">
          Powered by InvoicePro · {org?.website || "Secure Invoicing Platform"}
        </p>
      </div>
    </main>
  );
}
