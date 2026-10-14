"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import InvoiceForm, {
  type InvoicePayload,
} from "@/components/InvoiceForm";
import { RequireAuth } from "@/lib/auth";
import {
  apiErrorMessage,
  apiFetch,
  listAll,
  type Customer,
} from "@/lib/api";
import { ErrorBanner, PageTitle, Spinner } from "@/components/ui";

export default function NewInvoicePage() {
  return (
    <RequireAuth>
      <NewInvoiceBody />
    </RequireAuth>
  );
}

function NewInvoiceBody() {
  const router = useRouter();
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
    } finally {
      setBusy(false);
    }
  }

  if (!customers && !error) return <Spinner />;
  return (
    <div className="max-w-3xl">
      <PageTitle title="New invoice" />
      <ErrorBanner message={error} />
      {customers && (
        <InvoiceForm
          customers={customers}
          onSubmit={onSubmit}
          busy={busy}
          submitLabel="Create invoice"
        />
      )}
    </div>
  );
}
