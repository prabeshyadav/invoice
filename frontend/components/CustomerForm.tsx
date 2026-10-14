"use client";

import { useState, type FormEvent } from "react";
import {
  CURRENCIES,
  CUSTOMER_TYPES,
  LANGUAGES,
  SALUTATIONS,
  type Customer,
} from "@/lib/api";
import { Field, btnPrimary, inputCls, selectCls } from "./ui";

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

const EMPTY: CustomerPayload = {
  customer_type: "",
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

function Select({
  value,
  onChange,
  options,
  placeholder,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <select
      className={selectCls}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    >
      <option value="">{placeholder ?? "—"}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-4 text-[13px] font-semibold text-[#0f172a]">
      {children}
    </h3>
  );
}

export default function CustomerForm({
  initial,
  onSubmit,
  busy,
  submitLabel,
}: {
  initial?: Customer;
  onSubmit: (payload: CustomerPayload) => void;
  busy: boolean;
  submitLabel: string;
}) {
  const [form, setForm] = useState<CustomerPayload>({
    ...EMPTY,
    ...(initial as Partial<CustomerPayload>),
  });
  const set = (k: keyof CustomerPayload) => (v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Basic Info */}
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
        <SectionTitle>Basic Information</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Customer Type">
            <Select
              value={form.customer_type}
              onChange={set("customer_type")}
              options={CUSTOMER_TYPES}
            />
          </Field>
          <Field label="Salutation">
            <Select
              value={form.primary_contact}
              onChange={set("primary_contact")}
              options={SALUTATIONS}
              required
            />
          </Field>
          <Field label="First Name">
            <input
              className={inputCls}
              value={form.first_name}
              onChange={(e) => set("first_name")(e.target.value)}
              placeholder="First name"
              required
            />
          </Field>
          <Field label="Last Name">
            <input
              className={inputCls}
              value={form.last_name}
              onChange={(e) => set("last_name")(e.target.value)}
              placeholder="Last name"
              required
            />
          </Field>
          <Field label="Display Name">
            <input
              className={inputCls}
              value={form.customer_display_name}
              onChange={(e) => set("customer_display_name")(e.target.value)}
              placeholder="How the name appears"
              required
            />
          </Field>
          <Field label="Company">
            <input
              className={inputCls}
              value={form.company_name}
              onChange={(e) => set("company_name")(e.target.value)}
              placeholder="Company name (optional)"
            />
          </Field>
        </div>
      </div>

      {/* Contact */}
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
        <SectionTitle>Contact Details</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Email">
            <input
              className={inputCls}
              type="email"
              value={form.email}
              onChange={(e) => set("email")(e.target.value)}
              placeholder="email@example.com"
              required
            />
          </Field>
          <Field label="Phone">
            <input
              className={inputCls}
              value={form.phone}
              onChange={(e) => set("phone")(e.target.value)}
              placeholder="+1 (555) 000-0000"
              required
            />
          </Field>
          <Field label="Mobile">
            <input
              className={inputCls}
              value={form.mobile}
              onChange={(e) => set("mobile")(e.target.value)}
              placeholder="+1 (555) 000-0001"
              required
            />
          </Field>
          <Field label="Website">
            <input
              className={inputCls}
              value={form.website}
              onChange={(e) => set("website")(e.target.value)}
              placeholder="https://example.com"
            />
          </Field>
        </div>
      </div>

      {/* Settings */}
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
        <SectionTitle>Settings & Preferences</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Currency">
            <Select
              value={form.currency}
              onChange={set("currency")}
              options={CURRENCIES}
              required
            />
          </Field>
          <Field label="Portal Language">
            <Select
              value={form.Portal_Language}
              onChange={set("Portal_Language")}
              options={LANGUAGES}
            />
          </Field>
          <Field label="Individual Name">
            <input
              className={inputCls}
              value={form.individual_name}
              onChange={(e) => set("individual_name")(e.target.value)}
              placeholder="Individual name (optional)"
            />
          </Field>
        </div>
      </div>

      {/* Social */}
      <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm">
        <SectionTitle>Social Media</SectionTitle>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Facebook">
            <input
              className={inputCls}
              value={form.facebook}
              onChange={(e) => set("facebook")(e.target.value)}
              placeholder="Facebook profile URL"
            />
          </Field>
          <Field label="Twitter / X">
            <input
              className={inputCls}
              value={form.twitter}
              onChange={(e) => set("twitter")(e.target.value)}
              placeholder="@username"
            />
          </Field>
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
