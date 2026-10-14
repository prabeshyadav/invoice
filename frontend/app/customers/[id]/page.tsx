"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { RequireAuth } from "@/lib/auth";
import {
  apiErrorMessage,
  apiFetch,
  listAll,
  type Customer,
  type Invoice,
} from "@/lib/api";
import CustomerForm, {
  type CustomerPayload,
} from "@/components/CustomerForm";
import {
  ErrorBanner,
  PageTitle,
  Spinner,
  btnDanger,
  btnPrimary,
  btnSecondary,
  listWrap,
  rowHover,
} from "@/components/ui";

export default function CustomerDetailPage() {
  return (
    <RequireAuth>
      <Suspense fallback={<Spinner />}>
        <CustomerDetailBody />
      </Suspense>
    </RequireAuth>
  );
}

function CustomerDetailBody() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [c, all] = await Promise.all([
          apiFetch<Customer>(`/customers/${id}/`),
          listAll<Invoice>("/invoices/"),
        ]);
        setCustomer(c);
        setInvoices(all.filter((inv) => inv.customer_name === Number(id)));
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function onSave(payload: CustomerPayload) {
    setError(null);
    setBusy(true);
    try {
      const updated = await apiFetch<Customer>(`/customers/${id}/`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setCustomer(updated);
      setEditing(false);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!confirm("Delete this customer and all their invoices?")) return;
    setBusy(true);
    try {
      await apiFetch(`/customers/${id}/`, { method: "DELETE" });
      router.replace("/customers");
    } catch (e) {
      setError(apiErrorMessage(e));
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;
  if (!customer) return <ErrorBanner message={error ?? "Not found."} />;

  return (
    <div className="max-w-2xl">
      <PageTitle
        title={customer.customer_display_name}
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className={btnSecondary}
            >
              {editing ? "Cancel" : "Edit"}
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={busy}
              className={btnDanger}
            >
              Delete
            </button>
          </div>
        }
      />
      <ErrorBanner message={error} />
      {editing ? (
        <CustomerForm
          initial={customer}
          onSubmit={onSave}
          busy={busy}
          submitLabel="Save"
        />
      ) : (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border border-line bg-panel p-5 text-sm">
          <dt className="text-[#999]">Name</dt>
          <dd>
            {customer.first_name} {customer.last_name}
          </dd>
          <dt className="text-[#999]">Email</dt>
          <dd>{customer.email}</dd>
          <dt className="text-[#999]">Phone / Mobile</dt>
          <dd>
            {customer.phone} / {customer.mobile}
          </dd>
          <dt className="text-[#999]">Type / Currency</dt>
          <dd>
            {customer.customer_type || "—"} / {customer.currency}
          </dd>
          <dt className="text-[#999]">Company</dt>
          <dd>{customer.company_name || "—"}</dd>
        </dl>
      )}
      <div className="mb-3 mt-8 flex items-center justify-between">
        <h2 className="text-lg font-medium">
          Invoices ({invoices.length})
        </h2>
        <Link href="/invoices/new" className={btnPrimary}>
          New invoice
        </Link>
      </div>
      {invoices.length === 0 ? (
        <p className="text-sm text-[#999]">No invoices for this customer.</p>
      ) : (
        <ul className={listWrap}>
          {invoices.map((inv) => (
            <li key={inv.id}>
              <Link
                href={`/invoices/${inv.id}`}
                className={`flex items-center justify-between px-4 py-3 ${rowHover}`}
              >
                <span className="font-medium text-accent">{inv.invoice_number}</span>
                <span className="text-sm text-[#999]">{inv.subject}</span>
                <span className="text-sm">{inv.discounted_total_amount}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
