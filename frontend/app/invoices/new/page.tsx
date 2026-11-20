"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import InvoiceForm, { type InvoicePayload } from "@/components/InvoiceForm";
import { RequireAuth } from "@/lib/auth";
import { apiErrorMessage, apiFetch, listAll, type Customer } from "@/lib/api";
import { ErrorBanner, PageHeader, Spinner } from "@/components/ui";

export default function NewInvoicePage() {
  return (
    <RequireAuth>
      <Suspense fallback={<Spinner />}>
        <NewInvoiceBody />
      </Suspense>
    </RequireAuth>
  );
}

function NewInvoiceBody() {
  const router = useRouter();
  const preselected = Number(useSearchParams().get("customer")) || undefined;
  const [customers, setCustomers] = useState<Customer[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listAll<Customer>("/customers/")
      .then(setCustomers)
      .catch((e) => setError(apiErrorMessage(e)));
  }, []);

  async function onSubmit(payload: InvoicePayload) {
    setError(null);
    setBusy(true);
    try {
      const created = await apiFetch<{ id: number }>("/invoices/", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.replace(`/invoices/${created.id}`);
    } catch (e) {
      setError(apiErrorMessage(e));
      setBusy(false);
    }
  }

  if (!customers && !error) return <Spinner />;
  return (
    <>
      <PageHeader back={{ href: "/invoices", label: "Invoices" }} title="New invoice" />
      <ErrorBanner message={error} />
      {customers && (
        <InvoiceForm
          customers={customers}
          defaultCustomerId={preselected}
          onSubmit={onSubmit}
          busy={busy}
          submitLabel="Create invoice"
          cancelHref="/invoices"
        />
      )}
    </>
  );
}
