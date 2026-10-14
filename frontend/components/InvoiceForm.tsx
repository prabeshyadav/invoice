"use client";

import { useState, type FormEvent } from "react";
import {
  INVOICE_STATUSES,
  type Customer,
  type Invoice,
  type LineItem,
} from "@/lib/api";
import { Field, btnPrimary, btnSecondary, inputCls, selectCls } from "./ui";

export interface InvoicePayload {
  customer_name: number | "";
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  subject: string;
  status: string;
  line_items: { items_details: string; quantity: number; rate: number }[];
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function InvoiceForm({
  customers,
  initial,
  onSubmit,
  busy,
  submitLabel,
}: {
  customers: Customer[];
  initial?: Invoice;
  onSubmit: (payload: InvoicePayload) => void;
  busy: boolean;
  submitLabel: string;
}) {
  const [customerId, setCustomerId] = useState<number | "">(
    initial?.customer_name ?? ""
  );
  const [invoiceNumber, setInvoiceNumber] = useState(
    initial?.invoice_number ?? ""
  );
  const [invoiceDate, setInvoiceDate] = useState(
    initial?.invoice_date ?? todayPlus(0)
  );
  const [dueDate, setDueDate] = useState(initial?.due_date ?? todayPlus(30));
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [rows, setRows] = useState<
    { items_details: string; quantity: number; rate: number }[]
  >(
    initial?.line_items.map((l: LineItem) => ({
      items_details: l.items_details,
      quantity: l.quantity,
      rate: l.rate,
    })) ?? [{ items_details: "", quantity: 1, rate: 0 }]
  );

  const setRow =
    (i: number, k: "items_details" | "quantity" | "rate") =>
    (v: string) =>
      setRows((rs) =>
        rs.map((r, j) =>
          j === i
            ? { ...r, [k]: k === "items_details" ? v : Number(v) || 0 }
            : r
        )
      );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      customer_name: customerId,
      invoice_number: invoiceNumber,
      invoice_date: invoiceDate,
      due_date: dueDate,
      subject,
      status,
      line_items: rows.filter((r) => r.items_details.trim() !== ""),
    });
  }

  const previewTotal = rows.reduce((s, r) => s + r.quantity * r.rate, 0);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section: Basic info */}
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-[13px] font-semibold text-[#0f172a]">
          Invoice Details
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer">
            <select
              className={selectCls}
              value={customerId}
              onChange={(e) =>
                setCustomerId(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              required
            >
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.customer_display_name || `${c.first_name} ${c.last_name}`}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Invoice Number" hint="Leave blank for auto-generate">
            <input
              className={inputCls}
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-001"
            />
          </Field>

          <Field label="Invoice Date">
            <input
              className={inputCls}
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              required
            />
          </Field>

          <Field label="Due Date">
            <input
              className={inputCls}
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              required
            />
          </Field>

          <Field label="Subject">
            <input
              className={inputCls}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Invoice subject"
              required
            />
          </Field>

          <Field label="Status">
            <select
              className={selectCls}
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {INVOICE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* Section: Line items */}
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-[13px] font-semibold text-[#0f172a]">
          Line Items
        </h3>

        {/* Line item header */}
        <div className="mb-2 hidden grid-cols-12 gap-2 px-1 sm:grid">
          <span className="col-span-6 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Description</span>
          <span className="col-span-2 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Qty</span>
          <span className="col-span-2 text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Rate</span>
          <span className="col-span-1 text-right text-[11px] font-semibold uppercase tracking-wide text-[#94a3b8]">Total</span>
          <span className="col-span-1" />
        </div>

        <div className="space-y-2">
          {rows.map((r, i) => (
            <div
              key={i}
              className="grid grid-cols-12 items-center gap-2 rounded-xl bg-[#f8fafc] p-2"
            >
              <input
                className={`${inputCls} col-span-12 sm:col-span-6`}
                placeholder="Item description"
                value={r.items_details}
                onChange={(e) => setRow(i, "items_details")(e.target.value)}
                required
              />
              <input
                className={`${inputCls} col-span-4 sm:col-span-2`}
                type="number"
                min={1}
                placeholder="Qty"
                value={r.quantity}
                onChange={(e) => setRow(i, "quantity")(e.target.value)}
                required
              />
              <input
                className={`${inputCls} col-span-4 sm:col-span-2`}
                type="number"
                min={0}
                placeholder="Rate"
                value={r.rate}
                onChange={(e) => setRow(i, "rate")(e.target.value)}
                required
              />
              <span className="col-span-2 text-right text-[13px] font-medium text-[#0f172a] sm:col-span-1">
                {(r.quantity * r.rate).toLocaleString()}
              </span>
              <button
                type="button"
                aria-label="Remove row"
                disabled={rows.length === 1}
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                className="col-span-2 flex h-[38px] items-center justify-center rounded-xl border border-[#e2e8f0] bg-white text-[#94a3b8] transition hover:border-red-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 sm:col-span-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              setRows((rs) => [
                ...rs,
                { items_details: "", quantity: 1, rate: 0 },
              ])
            }
            className={btnSecondary}
          >
            + Add Row
          </button>
          <div className="rounded-xl bg-[#f8fafc] px-4 py-2 text-right">
            <span className="text-[11px] text-[#64748b]">Subtotal</span>
            <p className="text-lg font-bold text-[#0f172a]">
              {previewTotal.toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end">
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Saving…
            </span>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </form>
  );
}
