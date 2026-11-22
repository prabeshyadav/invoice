"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/lib/auth";
import {
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  apiErrorMessage,
  apiFetch,
  apiFetchRaw,
  displayStatus,
  formatDate,
  formatMoney,
  formatPercent,
  type Customer,
  type Invoice,
  type OrganizationProfile,
  type Payment,
} from "@/lib/api";
import Icon from "@/components/Icon";
import { Logo } from "@/components/AppShell";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/lib/toast";
import {
  Card,
  ErrorBanner,
  Field,
  PageHeader,
  Spinner,
  StatusBadge,
  btnDanger,
  btnPrimary,
  btnSecondary,
  card,
  inputCls,
  selectCls,
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
  const toast = useToast();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [org, setOrg] = useState<OrganizationProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentToDelete, setPaymentToDelete] = useState<Payment | null>(null);
  const [mail, setMail] = useState({ to: "", subject: "", message: "" });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    payment_date: "",
    payment_method: "bank_transfer",
    reference: "",
    notes: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const [inv, orgProfile] = await Promise.all([
          apiFetch<Invoice>(`/invoices/${id}/`),
          apiFetch<OrganizationProfile>(`/organization/`).catch(() => null),
        ]);
        setInvoice(inv);
        if (orgProfile) setOrg(orgProfile);
        setMail({
          to: "",
          subject: `Invoice ${inv.invoice_number}`,
          message: `Please find attached invoice ${inv.invoice_number}, due on ${formatDate(inv.due_date)}.`,
        });
        // Resilient auxiliary customer fetch
        try {
          const cust = await apiFetch<Customer>(`/customers/${inv.customer_name}/`);
          setCustomer(cust);
        } catch {
          // Auxiliary customer fetch failed, but invoice displays normally
        }
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function run(label: string, fn: () => Promise<void>) {
    setError(null);
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      const msg = apiErrorMessage(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(null);
    }
  }

  const duplicateInvoice = () =>
    run("duplicate", async () => {
      const newInv = await apiFetch<Invoice>(`/invoices/${id}/duplicate/`, {
        method: "POST",
      });
      toast.success(`Duplicated as ${newInv.invoice_number}.`);
      router.push(`/invoices/${newInv.id}`);
    });

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
      toast.success("PDF downloaded.");
    });

  const setStatus = (status: string) =>
    run("status", async () => {
      const updated = await apiFetch<Invoice>(`/invoices/${id}/`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setInvoice(updated);
      toast.success(`Invoice marked as ${status}.`);
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
      toast.success(data.detail);
      await refreshInvoice();
    });
  };

  const copyInvoiceNumber = () => {
    if (!invoice) return;
    navigator.clipboard.writeText(invoice.invoice_number);
    toast.success(`Copied ${invoice.invoice_number} to clipboard.`);
  };

  const copyShareLink = () => {
    if (!invoice?.share_token) return;
    const url = `${window.location.origin}/invoices/view/${invoice.share_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Client link copied to clipboard!");
  };

  const sendReminder = () =>
    run("reminder", async () => {
      const data = await apiFetch<{ detail: string }>(`/invoices/${id}/send_reminder/`, {
        method: "POST",
      });
      toast.success(data.detail);
      await refreshInvoice();
    });

  const refreshInvoice = async () => {
    try {
      const inv = await apiFetch<Invoice>(`/invoices/${id}/`);
      setInvoice(inv);
    } catch (e) {
      toast.error(apiErrorMessage(e));
    }
  };

  const openPaymentModal = () => {
    if (!invoice) return;
    setPaymentForm({
      amount: invoice.balance_due,
      payment_date: new Date().toISOString().split("T")[0],
      payment_method: "bank_transfer",
      reference: "",
      notes: "",
    });
    setShowPaymentModal(true);
  };

  const handleRecordPayment = async (e: FormEvent) => {
    e.preventDefault();
    if (!invoice) return;
    await run("payment", async () => {
      await apiFetch<Payment>("/payments/", {
        method: "POST",
        body: JSON.stringify({
          invoice: invoice.id,
          amount: paymentForm.amount,
          payment_date: paymentForm.payment_date,
          payment_method: paymentForm.payment_method,
          reference: paymentForm.reference.trim(),
          notes: paymentForm.notes.trim(),
        }),
      });
      toast.success(`Payment of ${formatMoney(paymentForm.amount)} recorded.`);
      setShowPaymentModal(false);
      await refreshInvoice();
    });
  };

  const handleDeletePayment = async () => {
    if (!paymentToDelete) return;
    await run("delete_payment", async () => {
      await apiFetch(`/payments/${paymentToDelete.id}/`, { method: "DELETE" });
      toast.success("Payment deleted.");
      setPaymentToDelete(null);
      await refreshInvoice();
    });
  };

  const confirmDelete = async () => {
    await run("delete", async () => {
      await apiFetch(`/invoices/${id}/`, { method: "DELETE" });
      toast.success("Invoice deleted.");
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
            <span className="flex items-center gap-2.5">
              <span>{invoice.invoice_number}</span>
              <button
                type="button"
                onClick={copyInvoiceNumber}
                title="Copy invoice number"
                className="rounded-md p-1 text-faint transition hover:bg-slate-100 hover:text-ink"
              >
                <Icon name="content_copy" className="text-[16px]" />
              </button>
              <StatusBadge status={status} />
            </span>
          }
          subtitle={invoice.subject}
          actions={
            <>
              {Number(invoice.balance_due) > 0 && (
                <button
                  type="button"
                  onClick={openPaymentModal}
                  disabled={!!busy}
                  className={`${btnSecondary} text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50`}
                >
                  <Icon name="payments" className="text-[18px] text-emerald-600" />
                  Record payment
                </button>
              )}
              {invoice.status !== "paid" && Number(invoice.balance_due) > 0 && (
                <button
                  type="button"
                  onClick={sendReminder}
                  disabled={!!busy}
                  className={`${btnSecondary} text-amber-700 hover:border-amber-200 hover:bg-amber-50`}
                  title="Send payment reminder email"
                >
                  <Icon name="notifications_active" className="text-[18px] text-amber-600" />
                  {busy === "reminder" ? "Sending…" : "Send reminder"}
                </button>
              )}
              {invoice.status !== "paid" && (
                <button
                  type="button"
                  onClick={() => setStatus("paid")}
                  disabled={!!busy}
                  className={`${btnSecondary} text-emerald-700 hover:border-emerald-200 hover:bg-emerald-50`}
                >
                  <Icon name="check_circle" className="text-[18px] text-emerald-600" />
                  Mark as paid
                </button>
              )}
              <Link href={`/invoices/${id}/edit`} className={btnSecondary}>
                <Icon name="edit" className="text-[18px]" />
                Edit
              </Link>
              <button
                type="button"
                onClick={duplicateInvoice}
                disabled={!!busy}
                className={btnSecondary}
                title="Create an editable duplicate"
              >
                <Icon name="content_copy" className="text-[18px]" />
                {busy === "duplicate" ? "Duplicating…" : "Duplicate"}
              </button>
              {invoice.share_token && (
                <button
                  type="button"
                  onClick={copyShareLink}
                  className={btnSecondary}
                  title="Copy client share link"
                >
                  <Icon name="link" className="text-[18px]" />
                  Share link
                </button>
              )}
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
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
        {/* Document preview */}
        <article className={`${card} p-6 sm:p-10 print:border-0 print:shadow-none`}>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="space-y-1">
              <Logo />
              {org?.company_name && (
                <p className="font-semibold text-ink pt-1">{org.company_name}</p>
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
              <p className="text-2xl font-semibold tracking-tight text-ink">INVOICE</p>
              <p className="text-sm text-muted">{invoice.invoice_number}</p>
              {invoice.first_viewed_at && (
                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-purple-50 px-2.5 py-1 text-[11px] font-medium text-purple-700 border border-purple-200" title={`First viewed: ${formatDate(invoice.first_viewed_at)}`}>
                  <Icon name="visibility" className="text-[13px]" />
                  <span>Viewed by client ({invoice.view_count ?? 1}x)</span>
                </div>
              )}
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
              <p className="text-xs font-medium uppercase tracking-wide text-faint">
                {Number(invoice.amount_paid) > 0 ? "Balance due" : "Amount due"}
              </p>
              <p className="tabular mt-1.5 text-2xl font-semibold text-ink">
                {formatMoney(invoice.balance_due ?? invoice.total)}
              </p>
              {Number(invoice.amount_paid) > 0 && (
                <p className="mt-0.5 text-xs text-muted">
                  Total: {formatMoney(invoice.total)} · Paid: {formatMoney(invoice.amount_paid)}
                </p>
              )}
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
                    <td className="py-3 text-right text-ink-2">{Number(l.quantity)}</td>
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
                  <dt>Amount paid</dt>
                  <dd>−{formatMoney(invoice.amount_paid)}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2 text-base font-semibold text-ink">
                  <dt>Balance due</dt>
                  <dd>{formatMoney(invoice.balance_due)}</dd>
                </div>
              </>
            )}
          </dl>

          {invoice.payments && invoice.payments.length > 0 && (
            <div className="mt-8 border-t border-line-soft pt-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-faint">
                  Payment History ({invoice.payments.length})
                </h3>
                <span className="text-xs font-medium text-emerald-700">
                  Total Paid: {formatMoney(invoice.amount_paid)}
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-line-soft bg-slate-50/50">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-line-soft text-left text-faint uppercase font-medium">
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Reference</th>
                      <th className="py-2.5 px-3">Notes</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                      <th className="py-2.5 px-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft">
                    {invoice.payments.map((p) => {
                      const methodLabel =
                        PAYMENT_METHODS.find((m) => m.value === p.payment_method)?.label ??
                        p.payment_method;
                      return (
                        <tr key={p.id} className="text-ink-2">
                          <td className="py-2.5 px-3 text-ink font-medium">
                            {formatDate(p.payment_date)}
                          </td>
                          <td className="py-2.5 px-3 capitalize">{methodLabel}</td>
                          <td className="py-2.5 px-3 font-mono text-muted">{p.reference || "—"}</td>
                          <td className="py-2.5 px-3 text-muted truncate max-w-[150px]">
                            {p.notes || "—"}
                          </td>
                          <td className="py-2.5 px-3 text-right font-medium text-emerald-700 tabular">
                            {formatMoney(p.amount)}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => setPaymentToDelete(p)}
                              title="Delete payment"
                              className="rounded p-1 text-faint transition hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Icon name="delete" className="text-[15px]" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(invoice.notes || invoice.terms || org?.bank_details || org?.invoice_notes) && (
            <div className="mt-8 border-t border-line-soft pt-6 space-y-4">
              {invoice.notes && (
                <div>
                  <p className="font-semibold uppercase tracking-wider text-faint text-[10px]">
                    Invoice Notes
                  </p>
                  <p className="mt-1 text-xs text-muted whitespace-pre-line">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <p className="font-semibold uppercase tracking-wider text-faint text-[10px]">
                    Terms &amp; Conditions
                  </p>
                  <p className="mt-1 text-xs text-muted whitespace-pre-line">{invoice.terms}</p>
                </div>
              )}
              {org?.bank_details && (
                <div className="rounded-lg bg-slate-50 p-4 border border-line-soft text-xs">
                  <p className="font-semibold uppercase tracking-wider text-faint text-[10px]">
                    Bank &amp; Payment Details
                  </p>
                  <p className="mt-1.5 whitespace-pre-line font-mono text-ink-2">
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
            {Number(invoice.balance_due) > 0 && (
              <button
                type="button"
                disabled={!!busy}
                onClick={openPaymentModal}
                className={`${btnPrimary} mt-3 w-full`}
              >
                <Icon name="payments" className="text-[18px]" />
                Record payment
              </button>
            )}
            {invoice.status !== "paid" && (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => setStatus("paid")}
                className={`${btnSecondary} mt-2 w-full`}
              >
                <Icon name="check_circle" className="text-[18px] text-success" />
                Mark as paid
              </button>
            )}
            <button
              type="button"
              disabled={!!busy}
              onClick={duplicateInvoice}
              className={`${btnSecondary} mt-2 w-full`}
            >
              <Icon name="content_copy" className="text-[18px]" />
              {busy === "duplicate" ? "Duplicating…" : "Duplicate invoice"}
            </button>
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

          <Card title="Activity & History" description="Audit log of client interactions and updates.">
            {(!invoice.activities || invoice.activities.length === 0) ? (
              <p className="text-xs text-muted">No activity recorded yet.</p>
            ) : (
              <div className="relative border-l border-line-soft ml-2 space-y-4 my-2">
                {invoice.activities.map((act) => {
                  const iconMap: Record<string, string> = {
                    created: "add_circle",
                    updated: "edit",
                    sent: "mail",
                    viewed: "visibility",
                    payment: "payments",
                    payment_deleted: "delete",
                    reminder: "notifications_active",
                    status: "flag",
                  };
                  const colorMap: Record<string, string> = {
                    created: "text-blue-500 bg-blue-50",
                    sent: "text-indigo-500 bg-indigo-50",
                    viewed: "text-purple-600 bg-purple-50",
                    payment: "text-emerald-600 bg-emerald-50",
                    payment_deleted: "text-rose-500 bg-rose-50",
                    reminder: "text-amber-600 bg-amber-50",
                    status: "text-slate-500 bg-slate-50",
                  };
                  const icon = iconMap[act.activity_type] || "info";
                  const color = colorMap[act.activity_type] || "text-slate-500 bg-slate-50";
                  return (
                    <div key={act.id} className="ml-4 text-xs">
                      <span className={`absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-line ${color}`}>
                        <Icon name={icon} className="text-[11px]" />
                      </span>
                      <p className="font-medium text-ink leading-tight">{act.message}</p>
                      <time className="text-[10px] text-faint">
                        {new Date(act.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                      </time>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            disabled={!!busy}
            className={`${btnDanger} w-full`}
          >
            <Icon name="delete" className="text-[18px]" />
            Delete invoice
          </button>
        </aside>
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        title="Delete invoice"
        description={
          <>
            Are you sure you want to permanently delete invoice{" "}
            <strong className="text-ink">{invoice.invoice_number}</strong>? This action cannot be
            undone.
          </>
        }
        confirmText="Delete invoice"
        busy={busy === "delete"}
        onConfirm={confirmDelete}
        onClose={() => setShowDeleteModal(false)}
      />

      <ConfirmModal
        isOpen={!!paymentToDelete}
        title="Delete payment"
        description={
          paymentToDelete ? (
            <>
              Are you sure you want to delete this payment of{" "}
              <strong className="text-ink">{formatMoney(paymentToDelete.amount)}</strong> recorded on{" "}
              {formatDate(paymentToDelete.payment_date)}? The invoice balance will be updated.
            </>
          ) : null
        }
        confirmText="Delete payment"
        busy={busy === "delete_payment"}
        onConfirm={handleDeletePayment}
        onClose={() => setPaymentToDelete(null)}
      />

      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={() => setShowPaymentModal(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-payment-title"
            className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-surface p-6 shadow-xl animate-in fade-in zoom-in-95"
          >
            <div className="flex items-center justify-between pb-3 border-b border-line-soft">
              <div>
                <h2 id="record-payment-title" className="text-base font-semibold text-ink">
                  Record payment
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Invoice {invoice.invoice_number} · Remaining balance: {formatMoney(invoice.balance_due)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="rounded-lg p-1 text-faint hover:bg-slate-100 hover:text-ink transition"
              >
                <Icon name="close" className="text-[20px]" />
              </button>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-4 mt-4">
              <Field label="Amount" required hint={`Max balance due: ${formatMoney(invoice.balance_due)}`}>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  className={inputCls}
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </Field>

              <Field label="Payment date" required>
                <input
                  type="date"
                  required
                  className={inputCls}
                  value={paymentForm.payment_date}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, payment_date: e.target.value }))}
                />
              </Field>

              <Field label="Payment method" required>
                <select
                  className={selectCls}
                  value={paymentForm.payment_method}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, payment_method: e.target.value }))}
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Reference / Transaction ID" hint="Optional cheque number or transaction receipt ID">
                <input
                  type="text"
                  placeholder="e.g. TXN-892147 or CHQ-0012"
                  className={inputCls}
                  value={paymentForm.reference}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, reference: e.target.value }))}
                />
              </Field>

              <Field label="Notes">
                <textarea
                  rows={2}
                  placeholder="Additional payment notes…"
                  className={textareaCls}
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </Field>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-line-soft">
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  disabled={busy === "payment"}
                  className={btnSecondary}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy === "payment"}
                  className={btnPrimary}
                >
                  {busy === "payment" ? "Recording…" : "Save payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
