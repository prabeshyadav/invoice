"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CustomerForm, { type CustomerPayload } from "@/components/CustomerForm";
import { RequireAuth } from "@/lib/auth";
import { apiErrorMessage, apiFetch } from "@/lib/api";
import { ErrorBanner, PageHeader } from "@/components/ui";

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
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <PageHeader back={{ href: "/customers", label: "Customers" }} title="Add customer" />
      <ErrorBanner message={error} />
      <CustomerForm onSubmit={onSubmit} busy={busy} submitLabel="Create customer" cancelHref="/customers" />
    </div>
  );
}
