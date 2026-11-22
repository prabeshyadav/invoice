"use client";

import { useState, type FormEvent, type HTMLInputTypeAttribute } from "react";
import Link from "next/link";
import { CURRENCIES, CUSTOMER_TYPES, LANGUAGES, SALUTATIONS, type Customer } from "@/lib/api";
import Icon from "./Icon";
import { Card, Field, Spinner, btnPrimary, btnSecondary, inputCls, selectCls } from "./ui";

export interface CustomerPayload {
  customer_type: string;
  primary_contact: string;
  first_name: string;
  last_name: string;
  company_name: string;
  customer_display_name: string;
  currency: string;
  individual_name: string;
  email: string;
  phone: string;
  website: string;
  mobile: string;
  Portal_Language: string;
  facebook: string;
  twitter: string;
}

type Key = keyof CustomerPayload;

const EMPTY: CustomerPayload = {
  customer_type: "business",
  primary_contact: "",
  first_name: "",
  last_name: "",
  company_name: "",
  customer_display_name: "",
  currency: "",
  individual_name: "",
  email: "",
  phone: "",
  website: "",
  mobile: "",
  Portal_Language: "",
  facebook: "",
  twitter: "",
};

export default function CustomerForm({
  initial,
  onSubmit,
  busy,
  submitLabel,
  onCancel,
  cancelHref,
}: {
  initial?: Customer;
  onSubmit: (payload: CustomerPayload) => void;
  busy: boolean;
  submitLabel: string;
  onCancel?: () => void;
  cancelHref?: string;
}) {
  const [form, setForm] = useState<CustomerPayload>(() => {
    const merged = { ...EMPTY };
    for (const k of Object.keys(EMPTY) as Key[]) {
      if (initial?.[k] != null) merged[k] = String(initial[k]);
    }
    return merged;
  });
  // Auto-fill the display name until the user edits it themselves.
  const [displayTouched, setDisplayTouched] = useState(!!initial);

  const set = (k: Key, v: string) =>
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (
        !displayTouched &&
        (k === "first_name" || k === "last_name" || k === "company_name" || k === "customer_type")
      ) {
        next.customer_display_name =
          next.customer_type === "business" && next.company_name
            ? next.company_name
            : `${next.first_name} ${next.last_name}`.trim();
      }
      return next;
    });

  const input = (k: Key, label: string, opts: { type?: HTMLInputTypeAttribute; placeholder?: string; required?: boolean } = {}) => (
    <Field label={label} required={opts.required}>
      <input
        className={inputCls}
        type={opts.type ?? "text"}
        value={form[k]}
        placeholder={opts.placeholder}
        required={opts.required}
        onChange={(e) => {
          if (k === "customer_display_name") setDisplayTouched(true);
          set(k, e.target.value);
        }}
      />
    </Field>
  );

  const select = (k: Key, label: string, options: string[], required = false) => (
    <Field label={label} required={required}>
      <select className={selectCls} value={form[k]} onChange={(e) => set(k, e.target.value)} required={required}>
        <option value="">Select…</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </Field>
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card title="Customer type">
        <div className="grid grid-cols-2 gap-3 sm:max-w-md">
          {CUSTOMER_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => set("customer_type", t)}
              aria-pressed={form.customer_type === t}
              className={`flex items-center gap-2.5 rounded-lg border px-4 py-3 text-left text-sm font-medium capitalize transition ${
                form.customer_type === t
                  ? "border-accent bg-accent-soft text-accent ring-1 ring-accent"
                  : "border-line text-ink-2 hover:border-slate-300"
              }`}
            >
              <Icon name={t === "business" ? "apartment" : "person"} className="text-[20px]" />
              {t}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Primary contact">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <div className="sm:col-span-2">{select("primary_contact", "Salutation", SALUTATIONS, true)}</div>
          <div className="sm:col-span-2">{input("first_name", "First name", { required: true })}</div>
          <div className="sm:col-span-2">{input("last_name", "Last name", { required: true })}</div>
          <div className="sm:col-span-3">{input("company_name", "Company name", { placeholder: "Optional" })}</div>
          <div className="sm:col-span-3">
            {input("customer_display_name", "Display name", { required: true, placeholder: "Shown on invoices" })}
          </div>
        </div>
      </Card>

      <Card title="Contact details">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {input("email", "Email", { type: "email", required: true, placeholder: "name@company.com" })}
          {input("website", "Website", { placeholder: "https://" })}
          {input("mobile", "Mobile", { type: "tel", required: true, placeholder: "e.g. +977 9800000000" })}
          {input("phone", "Work phone (optional)", { type: "tel", required: false, placeholder: "e.g. 01-4400000" })}
        </div>
      </Card>

      <Card title="Preferences & social">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {select("currency", "Currency", CURRENCIES, true)}
          {select("Portal_Language", "Portal language", LANGUAGES)}
          {input("facebook", "Facebook", { placeholder: "Profile URL" })}
          {input("twitter", "Twitter / X", { placeholder: "@handle" })}
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <button type="button" onClick={onCancel} className={btnSecondary}>
            Cancel
          </button>
        ) : (
          cancelHref && (
            <Link href={cancelHref} className={btnSecondary}>
              Cancel
            </Link>
          )
        )}
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy && <Spinner inline />}
          {busy ? "Saving…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
