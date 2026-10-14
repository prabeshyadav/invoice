"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/lib/auth";
import {
  apiErrorMessage,
  apiFetch,
  apiFetchRaw,
  type Invoice,
} from "@/lib/api";
import {
  ErrorBanner,
  Field,
  PageTitle,
  Spinner,
  SuccessBanner,
  btnDanger,
  btnPrimary,
  btnSecondary,
  inputCls,
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
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mail, setMail] = useState({ to: "", subject: "", message: "" });
  const [mailResult, setMailResult] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<Invoice>(`/invoices/${id}/`)
      .then((inv) => {
        setInvoice(inv);
        setMail({
          to: "",
          subject: `Invoice ${inv.invoice_number}`,
          message: `Please find attached invoice ${inv.invoice_number} due on ${inv.due_date}.`,
        });
      })
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [id]);

  async function downloadPdf() {
    setError(null);
    setBusy(true);
    try {
      const res = await apiFetchRaw(`/invoices/${id}/pdf/`);
      if (!res.ok) throw new Error(`PDF failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoice?.invoice_number ?? id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "PDF download failed.");
    } finally {
      setBusy(false);
    }
  }

  async function sendEmail(e: FormEvent) {
    e.preventDefault();
    setMailResult(null);
    setError(null);
    setBusy(true);
    try {
      const body: Record<string, string> = {};
      if (mail.to.trim()) body.to = mail.to.trim();
      if (mail.subject.trim()) body.subject = mail.subject.trim();
      if (mail.message.trim()) body.message = mail.message.trim();
      const data = await apiFetch<{ detail: string }>(
        `/invoices/${id}/send_email/`,
        { method: "POST", body: JSON.stringify(body) }
      );
      setMailResult(data.detail);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!confirm("Delete this invoice?")) return;
    setBusy(true);
    try {
      await apiFetch(`/invoices/${id}/`, { method: "DELETE" });
      router.replace("/invoices");
    } catch (e) {
      setError(apiErrorMessage(e));
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;
  if (!invoice) return <ErrorBanner message={error ?? "Not found."} />;

  return (
    <div className="max-w-3xl">
      <PageTitle
        title={`Invoice ${invoice.invoice_number}`}
        action={
          <div className="flex gap-2">
            <Link href={`/invoices/${id}/edit`} className={btnSecondary}>
              Edit
            </Link>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={busy}
              className={btnPrimary}
            >
              PDF
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className={btnDanger}
            >
              Delete
            </button>
          </div>
        }
      />
      <ErrorBanner message={error} />
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border border-line bg-panel p-5 text-sm">
        <dt className="text-[#999]">Subject</dt>
        <dd>{invoice.subject}</dd>
        <dt className="text-[#999]">Dates</dt>
        <dd>
          {invoice.invoice_date} → {invoice.due_date}
        </dd>
        <dt className="text-[#999]">Status</dt>
        <dd>{invoice.status}</dd>
      </dl>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[#999]">
            <th className="py-2">Item</th>
            <th className="text-right">Qty</th>
            <th className="text-right">Rate</th>
            <th className="text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.line_items.map((l) => (
            <tr key={l.id} className="border-b border-line hover:bg-panel">
              <td className="py-2">{l.items_details}</td>
              <td className="text-right">{l.quantity}</td>
              <td className="text-right">{l.rate}</td>
              <td className="text-right">{l.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 space-y-1 text-right text-sm">
        <p>Subtotal: {invoice.sub_total}</p>
        <p>Discount: {invoice.discount_amount}</p>
        <p className="text-base font-semibold">
          Total: {invoice.discounted_total_amount}
        </p>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-medium">Email invoice</h2>
      <SuccessBanner message={mailResult} />
      <form onSubmit={sendEmail} className="max-w-xl space-y-3">
        <Field label="To (blank = customer email)">
          <input
            className={inputCls}
            type="email"
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
            className={inputCls}
            rows={3}
            value={mail.message}
            onChange={(e) => setMail((m) => ({ ...m, message: e.target.value }))}
          />
        </Field>
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? "Sending…" : "Send email"}
        </button>
      </form>
    </div>
  );
}
