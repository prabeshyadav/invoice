"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RequireAuth } from "@/lib/auth";
import { useToast } from "@/lib/toast";
import { apiErrorMessage, customerName, listAll, type Customer } from "@/lib/api";
import Icon from "@/components/Icon";
import {
  Avatar,
  Card,
  EmptyState,
  ErrorBanner,
  PageHeader,
  SearchInput,
  Spinner,
  btnPrimary,
  btnSecondary,
  td,
  th,
  trLink,
} from "@/components/ui";

export default function CustomersPage() {
  return (
    <RequireAuth>
      <CustomersBody />
    </RequireAuth>
  );
}

function CustomersBody() {
  const router = useRouter();
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listAll<Customer>("/customers/")
      .then(setCustomers)
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const q = search.trim().toLowerCase();
  const filtered = customers.filter((c) =>
    [customerName(c), c.email, c.company_name, c.phone].some((v) => v?.toLowerCase().includes(q))
  );

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} customer${customers.length === 1 ? "" : "s"} in your address book.`}
        actions={
          <div className="flex items-center gap-2">
            {customers.length > 0 && (
              <a
                href="/api/customers/export_csv/"
                download="customers.csv"
                className={btnSecondary}
                title="Download customers spreadsheet"
              >
                <Icon name="download" className="text-[18px]" />
                Export CSV
              </a>
            )}
            <Link href="/customers/new" className={btnPrimary}>
              <Icon name="person_add" className="text-[18px]" />
              Add customer
            </Link>
          </div>
        }
      />
      <ErrorBanner message={error} />

      <Card padded={false}>
        {customers.length > 0 && (
          <div className="border-b border-line-soft p-4">
            <SearchInput value={search} onChange={setSearch} placeholder="Search name, email, company…" />
          </div>
        )}
        {filtered.length === 0 ? (
          customers.length === 0 ? (
            <EmptyState
              icon="group"
              title="No customers yet"
              description="Add a customer to start sending them invoices."
              action={
                <Link href="/customers/new" className={btnPrimary}>
                  Add customer
                </Link>
              }
            />
          ) : (
            <EmptyState
              icon="search_off"
              title="No matching customers"
              description="Try a different search term or clear the search input."
              action={
                <button type="button" onClick={() => setSearch("")} className={btnSecondary}>
                  Clear search
                </button>
              }
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
              <thead>
                <tr>
                  <th className={th}>Name</th>
                  <th className={th}>Email</th>
                  <th className={th}>Phone</th>
                  <th className={th}>Type</th>
                  <th className={th}>Currency</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const name = customerName(c);
                  return (
                    <tr key={c.id} className={`${trLink} group`} onClick={() => router.push(`/customers/${c.id}`)}>
                      <td className={td}>
                        <div className="flex items-center gap-3">
                          <Avatar name={name} />
                          <div className="min-w-0">
                            <Link href={`/customers/${c.id}`} className="font-semibold text-ink hover:text-accent">
                              {name}
                            </Link>
                            {c.company_name && <p className="truncate text-xs text-muted">{c.company_name}</p>}
                          </div>
                        </div>
                      </td>
                      <td className={`${td} text-ink-2`}>
                        <div className="flex items-center gap-1.5">
                          <span>{c.email}</span>
                          <button
                            type="button"
                            title="Copy email"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(c.email);
                              toast.success(`Copied ${c.email}`);
                            }}
                            className="rounded-md p-0.5 text-faint opacity-0 transition group-hover:opacity-100 hover:bg-slate-100 hover:text-ink"
                          >
                            <Icon name="content_copy" className="text-[14px]" />
                          </button>
                        </div>
                      </td>
                      <td className={`${td} text-muted`}>{c.phone || c.mobile || "—"}</td>
                      <td className={`${td} capitalize text-muted`}>{c.customer_type || "—"}</td>
                      <td className={td}>
                        <span className="rounded-md bg-line-soft px-2 py-0.5 text-xs font-medium text-ink-2">{c.currency}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
