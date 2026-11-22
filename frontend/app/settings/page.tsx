"use client";

import { useEffect, useState, type FormEvent } from "react";
import { RequireAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { apiErrorMessage, apiFetch, type OrganizationProfile } from "@/lib/api";
import Icon from "@/components/Icon";
import {
  Card,
  ErrorBanner,
  Field,
  PageHeader,
  Spinner,
  btnPrimary,
  inputCls,
  textareaCls,
} from "@/components/ui";

const EMPTY_PROFILE: OrganizationProfile = {
  company_name: "InvoicePro",
  tax_id: "",
  email: "",
  phone: "",
  address: "",
  website: "",
  bank_details: "",
  invoice_notes: "",
};

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsBody />
    </RequireAuth>
  );
}

function SettingsBody() {
  const toast = useToast();
  const [profile, setProfile] = useState<OrganizationProfile>(EMPTY_PROFILE);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<OrganizationProfile>("/organization/")
      .then((data) => setProfile(data))
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof OrganizationProfile>(k: K, v: OrganizationProfile[K]) =>
    setProfile((p) => ({ ...p, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const updated = await apiFetch<OrganizationProfile>("/organization/", {
        method: "POST",
        body: JSON.stringify(profile),
      });
      setProfile(updated);
      toast.success("Organization profile updated.");
    } catch (err) {
      const msg = apiErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Settings"
        subtitle="Manage your business profile, tax registration, and payment details."
      />
      <ErrorBanner message={error} />

      <form onSubmit={onSubmit} className="space-y-6">
        <Card title="Business profile" description="This information appears at the top of your invoices and PDFs.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Business name" required className="sm:col-span-2">
              <input
                className={inputCls}
                value={profile.company_name}
                onChange={(e) => set("company_name", e.target.value)}
                placeholder="e.g. Acme Studio"
                required
              />
            </Field>
            <Field label="Tax / PAN / VAT ID" hint="Displayed under your business name">
              <input
                className={inputCls}
                value={profile.tax_id}
                onChange={(e) => set("tax_id", e.target.value)}
                placeholder="e.g. 600123456"
              />
            </Field>
            <Field label="Website">
              <input
                className={inputCls}
                value={profile.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://example.com"
              />
            </Field>
            <Field label="Billing email">
              <input
                className={inputCls}
                type="email"
                value={profile.email}
                onChange={(e) => set("email", e.target.value)}
                placeholder="billing@example.com"
              />
            </Field>
            <Field label="Contact phone">
              <input
                className={inputCls}
                type="tel"
                value={profile.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+977 9800000000"
              />
            </Field>
            <Field label="Office address" className="sm:col-span-2">
              <textarea
                className={textareaCls}
                rows={2}
                value={profile.address}
                onChange={(e) => set("address", e.target.value)}
                placeholder="Street address, City, Country"
              />
            </Field>
          </div>
        </Card>

        <Card
          title="Payment & bank instructions"
          description="Provide details for bank transfer, wire, or QR payment to your clients."
        >
          <div className="space-y-4">
            <Field
              label="Bank / Payment details"
              hint="Include Bank Name, Account Holder, Account Number, SWIFT / Routing, or wallet IDs."
            >
              <textarea
                className={textareaCls}
                rows={4}
                value={profile.bank_details}
                onChange={(e) => set("bank_details", e.target.value)}
                placeholder="Bank: Nabil Bank&#10;Account Name: Acme Pvt. Ltd.&#10;A/C No: 01020304050607&#10;Branch: New Baneshwor"
              />
            </Field>
            <Field
              label="Default invoice terms & notes"
              hint="Shown at the bottom of all generated invoices."
            >
              <textarea
                className={textareaCls}
                rows={3}
                value={profile.invoice_notes}
                onChange={(e) => set("invoice_notes", e.target.value)}
                placeholder="Payment is due within 30 days. Thank you for your business!"
              />
            </Field>
          </div>
        </Card>

        <div className="flex justify-end">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? <Spinner inline /> : <Icon name="check" className="text-[18px]" />}
            {busy ? "Saving…" : "Save settings"}
          </button>
        </div>
      </form>
    </div>
  );
}
