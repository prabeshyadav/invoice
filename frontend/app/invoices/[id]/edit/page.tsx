"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import InvoiceForm, {
  type InvoicePayload,
} from "@/components/InvoiceForm";
import { RequireAuth } from "@/lib/auth";
import {
  apiErrorMessage,
  apiFetch,
  listAll,
  type Customer,
  type Invoice,
} from "@/lib/api";
import { ErrorBanner, PageTitle, Spinner } from "@/components/ui";

export default function EditInvoicePage() {
  return (
    <RequireAuth>
      <Suspense fallback={<Spinner />}>
        <EditInvoiceBody />
      </Suspense>
    </RequireAuth>
  );
}

function EditInvoiceBody() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [c, inv] = await Promise.all([
          listAll<Customer>("/customers/"),
          apiFetch<Invoice>(`/invoices/${id}/`),
        ]);
        setCustomers(c);
        setInvoice(inv);
      } catch (e) {
        setError(apiErrorMessage(e));
      }
    })();
  }, [id]);

  async function onSubmit(payload: InvoicePayload) {
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/invoices/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      router.replace(`/invoices/${id}`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!invoice && !error) return <Spinner />;
  return (
    <div className="max-w-3xl">
      <PageTitle title={`Edit ${invoice?.invoice_number ?? "invoice"}`} />
      <ErrorBanner message={error} />
      {invoice && (
        <InvoiceForm
          customers={customers}
          initial={invoice}
          onSubmit={onSubmit}
          busy={busy}
          submitLabel="Save changes"
        />
      )}
    </div>
  );
}
