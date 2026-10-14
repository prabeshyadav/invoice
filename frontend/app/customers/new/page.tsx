"use client";

import CustomerForm, { type CustomerPayload } from "@/components/CustomerForm";
import { RequireAuth } from "@/lib/auth";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { ErrorBanner, PageTitle } from "@/components/ui";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCustomerPage() {
  return (
    <RequireAuth>
      <NewCustomerBody />
    </RequireAuth>
  );
}

function NewCustomerBody() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(payload: CustomerPayload) {
    setError(null);
    setBusy(true);
    try {
      const created = await apiFetch<{ id: number }>("/customers/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.replace(`/customers/${created.id}`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <PageTitle title="Add customer" />
      <ErrorBanner message={error} />
      <CustomerForm onSubmit={onSubmit} busy={busy} submitLabel="Create" />
    </div>
  );
}
