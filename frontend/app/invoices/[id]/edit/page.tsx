"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import InvoiceForm, { type InvoicePayload } from "@/components/InvoiceForm";
import { RequireAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { apiErrorMessage, apiFetch, listAll, type Customer, type Invoice } from "@/lib/api";
import { ErrorBanner, PageHeader, Spinner } from "@/components/ui";

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
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([listAll<Customer>("/customers/"), apiFetch<Invoice>(`/invoices/${id}/`)])
      .then(([c, inv]) => {
        setCustomers(c);
        setInvoice(inv);
      })
      .catch((e) => setError(apiErrorMessage(e)));
  }, [id]);

  async function onSubmit(payload: InvoicePayload) {
    setError(null);
    setBusy(true);
    try {
      await apiFetch(`/invoices/${id}/`, { method: "PATCH", body: JSON.stringify(payload) });
      toast.success("Invoice updated successfully.");
      router.replace(`/invoices/${id}`);
    } catch (e) {
      setError(apiErrorMessage(e));
      setBusy(false);
    }
  }

  if (!invoice && !error) return <Spinner />;
  return (
    <>
      <PageHeader
        back={{ href: `/invoices/${id}`, label: invoice?.invoice_number ?? "Invoice" }}
        title={`Edit ${invoice?.invoice_number ?? "invoice"}`}
      />
      <ErrorBanner message={error} />
      {invoice && (
        <InvoiceForm
          customers={customers}
          initial={invoice}
          onSubmit={onSubmit}
          busy={busy}
          submitLabel="Save changes"
          cancelHref={`/invoices/${id}`}
        />
      )}
    </>
  );
}
