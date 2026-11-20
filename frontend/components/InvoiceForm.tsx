"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  INVOICE_STATUSES,
  customerName,
  formatMoney,
  listAll,
  roundMoney,
  type CatalogItem,
  type Customer,
  type Invoice,
} from "@/lib/api";
import Icon from "./Icon";
import { Card, Field, Spinner, btnGhost, btnPrimary, btnSecondary, inputCls, selectCls } from "./ui";

type Row = { items_details: string; quantity: number; rate: number };

export interface InvoicePayload {
  customer_name: number | "";
  invoice_number?: string;
  invoice_date: string;
  due_date: string;
  subject: string;
  status: string;
  discount_percent: number;
  tax_percent: number;
  line_items: Row[];
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const EMPTY_ROW: Row = { items_details: "", quantity: 1, rate: 0 };

function PercentInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-ink-2">
      <span>{label}</span>
      <span className="relative w-24">
        <input
          className={`${inputCls} tabular h-9 pr-7 text-right`}
          type="number"
          min={0}
          max={100}
          step="0.01"
          aria-label={`${label} percent`}
          value={value}
          onChange={(e) => onChange(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-faint">%</span>
      </span>
    </label>
  );
}

export default function InvoiceForm({
  customers,
  initial,
  defaultCustomerId,
  onSubmit,
  busy,
  submitLabel,
  cancelHref,
}: {
  customers: Customer[];
  initial?: Invoice;
  defaultCustomerId?: number;
  onSubmit: (payload: InvoicePayload) => void;
  busy: boolean;
  submitLabel: string;
  cancelHref: string;
}) {
  const [customerId, setCustomerId] = useState<number | "">(initial?.customer_name ?? defaultCustomerId ?? "");
  const [invoiceNumber, setInvoiceNumber] = useState(initial?.invoice_number ?? "");
  const [invoiceDate, setInvoiceDate] = useState(initial?.invoice_date ?? todayPlus(0));
  const [dueDate, setDueDate] = useState(initial?.due_date ?? todayPlus(30));
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [status, setStatus] = useState(initial?.status ?? "draft");
  const [discountPercent, setDiscountPercent] = useState(Number(initial?.discount_percent ?? 0));
  const [taxPercent, setTaxPercent] = useState(Number(initial?.tax_percent ?? 0));
  const [rows, setRows] = useState<Row[]>(
    initial?.line_items.length
      ? initial.line_items.map(({ items_details, quantity, rate }) => ({
          items_details,
          quantity: Number(quantity),
          rate: Number(rate),
        }))
      : [{ ...EMPTY_ROW }]
  );
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);

  useEffect(() => {
    listAll<CatalogItem>("/items/")
      .then(setCatalog)
      .catch(() => setCatalog([]));
  }, []);

  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  function addFromCatalog(itemId: string) {
    const item = catalog.find((c) => c.id === Number(itemId));
    if (!item) return;
    const row = { items_details: item.name, quantity: 1, rate: Number(item.selling_price) };
    // Fill the first blank row instead of leaving an empty one behind.
    setRows((rs) => {
      const blank = rs.findIndex((r) => !r.items_details.trim());
      return blank === -1 ? [...rs, row] : rs.map((r, j) => (j === blank ? row : r));
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      customer_name: customerId,
      ...(invoiceNumber.trim() ? { invoice_number: invoiceNumber.trim() } : {}),
      invoice_date: invoiceDate,
      due_date: dueDate,
      subject,
      status,
      discount_percent: discountPercent,
      tax_percent: taxPercent,
      line_items: rows.filter((r) => r.items_details.trim() !== ""),
    });
  }

  // Same order and rounding as Invoice in management/models.py.
  const subtotal = rows.reduce((s, r) => s + roundMoney(r.quantity * r.rate), 0);
  const discount = roundMoney((subtotal * discountPercent) / 100);
  const taxable = subtotal - discount;
  const tax = roundMoney((taxable * taxPercent) / 100);
  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_300px]">
      <div className="space-y-6">
        <Card title="Details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Customer" required className="sm:col-span-2">
              <select
                className={selectCls}
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value === "" ? "" : Number(e.target.value))}
                required
              >
                <option value="">Select a customer…</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {customerName(c)}
                    {c.company_name ? ` — ${c.company_name}` : ""}
                  </option>
                ))}
              </select>
              {customers.length === 0 && (
                <span className="mt-1.5 block text-xs text-muted">
                  No customers yet.{" "}
                  <Link href="/customers/new" className="font-medium text-accent hover:underline">
                    Add one first
                  </Link>
                  .
                </span>
              )}
            </Field>
            <Field label="Subject" required className="sm:col-span-2">
              <input
                className={inputCls}
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Website redesign — phase 1"
                required
              />
            </Field>
            <Field label="Invoice date" required>
              <input className={inputCls} type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} required />
            </Field>
            <Field label="Due date" required>
              <input
                className={inputCls}
                type="date"
                min={invoiceDate}
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </Field>
            <Field label="Invoice number" hint={initial ? undefined : "Leave blank to auto-generate (KIT-101, KIT-102…)"}>
              <input
                className={inputCls}
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                placeholder="Auto"
              />
            </Field>
            <Field label="Status">
              <select className={`${selectCls} capitalize`} value={status} onChange={(e) => setStatus(e.target.value)}>
                {INVOICE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Card>

        <Card
          title="Line items"
          padded={false}
          actions={
            catalog.length > 0 && (
              <select
                className={selectCls.replace("w-full", "w-48 sm:w-56").replace("h-10", "h-9")}
                value=""
                onChange={(e) => addFromCatalog(e.target.value)}
                aria-label="Add from catalog"
              >
                <option value="">+ Add from catalog</option>
                {catalog.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {formatMoney(c.selling_price)}
                  </option>
                ))}
              </select>
            )
          }
        >
          <div className="hidden grid-cols-[1fr_90px_120px_110px_40px] gap-3 px-5 pt-4 text-xs font-medium uppercase tracking-wide text-faint md:grid">
            <span>Description</span>
            <span>Qty</span>
            <span>Rate</span>
            <span className="text-right">Amount</span>
            <span />
          </div>
          <div className="space-y-3 p-5 md:space-y-2 md:pt-2">
            {rows.map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1fr_auto] gap-2 rounded-lg border border-line-soft p-3 md:grid-cols-[1fr_90px_120px_110px_40px] md:items-center md:gap-3 md:border-0 md:p-0"
              >
                <input
                  className={`${inputCls} col-span-3 md:col-span-1`}
                  placeholder="Item or service description"
                  aria-label="Description"
                  value={r.items_details}
                  onChange={(e) => updateRow(i, { items_details: e.target.value })}
                  required={i === 0}
                />
                <input
                  className={`${inputCls} tabular`}
                  type="number"
                  min={0.01}
                  step="0.01"
                  aria-label="Quantity"
                  value={r.quantity}
                  onChange={(e) => updateRow(i, { quantity: Math.max(0, Number(e.target.value) || 0) })}
                  required
                />
                <input
                  className={`${inputCls} tabular`}
                  type="number"
                  min={0}
                  step="0.01"
                  aria-label="Rate"
                  value={r.rate}
                  onChange={(e) => updateRow(i, { rate: Math.max(0, Number(e.target.value) || 0) })}
                  required
                />
                <span className="tabular hidden text-right text-sm font-medium text-ink md:block">
                  {formatMoney(roundMoney(r.quantity * r.rate))}
                </span>
                <button
                  type="button"
                  aria-label="Remove line"
                  disabled={rows.length === 1}
                  onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-faint transition hover:bg-red-50 hover:text-danger disabled:opacity-30"
                >
                  <Icon name="delete" className="text-[18px]" />
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setRows((rs) => [...rs, { ...EMPTY_ROW }])} className={`${btnGhost} -ml-2 text-accent`}>
              <Icon name="add" className="text-[18px]" />
              Add line
            </button>
          </div>
        </Card>
      </div>

      <div>
        <div className="space-y-4 xl:sticky xl:top-10">
          <Card title="Summary">
            <div className="space-y-2 border-b border-line-soft pb-4 text-sm">
              {selectedCustomer && (
                <p className="flex justify-between gap-2">
                  <span className="text-muted">Currency</span>
                  <span className="font-medium">{selectedCustomer.currency}</span>
                </p>
              )}
              <PercentInput label="Discount" value={discountPercent} onChange={setDiscountPercent} />
              <PercentInput label="Tax" value={taxPercent} onChange={setTaxPercent} />
            </div>
            <dl className="tabular mt-4 space-y-2 text-sm">
              <div className="flex justify-between text-ink-2">
                <dt>Subtotal</dt>
                <dd>{formatMoney(subtotal)}</dd>
              </div>
              <div className="flex justify-between text-ink-2">
                <dt>Discount</dt>
                <dd>−{formatMoney(discount)}</dd>
              </div>
              <div className="flex justify-between text-ink-2">
                <dt>Tax</dt>
                <dd>{formatMoney(tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-lg font-semibold text-ink">
                <dt>Total</dt>
                <dd>{formatMoney(taxable + tax)}</dd>
              </div>
            </dl>
          </Card>
          <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
            {busy ? <Spinner inline /> : <Icon name="check" className="text-[18px]" />}
            {busy ? "Saving…" : submitLabel}
          </button>
          <Link href={cancelHref} className={`${btnSecondary} w-full`}>
            Cancel
          </Link>
        </div>
      </div>
    </form>
  );
}
