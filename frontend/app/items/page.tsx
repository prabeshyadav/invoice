"use client";

import { useEffect, useState, type FormEvent } from "react";
import { RequireAuth } from "@/lib/auth";
import { ITEM_TYPES, apiErrorMessage, apiFetch, formatMoney, listAll, type CatalogItem } from "@/lib/api";
import Icon from "@/components/Icon";
import {
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  PageHeader,
  SearchInput,
  Spinner,
  btnPrimary,
  inputCls,
  td,
  th,
} from "@/components/ui";

const EMPTY = { type: "Services", name: "", description: "", selling_price: 0, tax: 0, unit: "" };

export default function ItemsPage() {
  return (
    <RequireAuth>
      <ItemsBody />
    </RequireAuth>
  );
}

function ItemsBody() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listAll<CatalogItem>("/items/")
      .then(setItems)
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const created = await apiFetch<CatalogItem>("/items/", { method: "POST", body: JSON.stringify(form) });
      setItems((xs) => [created, ...xs]);
      setForm(EMPTY);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(item: CatalogItem) {
    if (!confirm(`Delete "${item.name}" from the catalog?`)) return;
    try {
      await apiFetch(`/items/${item.id}/`, { method: "DELETE" });
      setItems((xs) => xs.filter((x) => x.id !== item.id));
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }

  if (loading) return <Spinner />;

  const q = search.trim().toLowerCase();
  const filtered = items.filter((it) => !q || it.name.toLowerCase().includes(q) || it.description.toLowerCase().includes(q));

  return (
    <>
      <PageHeader title="Items" subtitle="Reusable goods and services you can add to invoices in one click." />
      <ErrorBanner message={error} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <Card padded={false} className="order-2 xl:order-1">
          {items.length > 0 && (
            <div className="border-b border-line-soft p-4">
              <SearchInput value={search} onChange={setSearch} placeholder="Search items…" />
            </div>
          )}
          {filtered.length === 0 ? (
            <EmptyState
              icon="inventory_2"
              title={items.length ? "No matching items" : "Your catalog is empty"}
              description={items.length ? "Try a different search term." : "Add products or services you bill often."}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr>
                    <th className={th}>Item</th>
                    <th className={th}>Type</th>
                    <th className={`${th} text-right`}>Price</th>
                    <th className={`${th} text-right`}>Tax</th>
                    <th className={th} />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((it) => (
                    <tr key={it.id} className="group border-t border-line-soft hover:bg-slate-50/80">
                      <td className={td}>
                        <p className="font-medium text-ink">{it.name}</p>
                        <p className="max-w-[280px] truncate text-xs text-muted">{it.description}</p>
                      </td>
                      <td className={td}>
                        <span className="inline-flex items-center gap-1 rounded-md bg-line-soft px-2 py-0.5 text-xs font-medium text-ink-2">
                          <Icon name={it.type === "Goods" ? "package_2" : "handyman"} className="text-[14px]" />
                          {it.type || "—"}
                        </span>
                      </td>
                      <td className={`${td} tabular text-right`}>
                        <span className="font-medium">{formatMoney(it.selling_price)}</span>
                        <span className="text-xs text-muted"> / {it.unit}</span>
                      </td>
                      <td className={`${td} tabular text-right text-muted`}>{it.tax}</td>
                      <td className={`${td} w-12 text-right`}>
                        <button
                          type="button"
                          onClick={() => onDelete(it)}
                          aria-label={`Delete ${it.name}`}
                          className="rounded-md p-1.5 text-faint opacity-60 transition hover:bg-red-50 hover:text-danger group-hover:opacity-100"
                        >
                          <Icon name="delete" className="text-[18px]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="New item" className="order-1 h-fit xl:order-2">
          <form onSubmit={onCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-line-soft p-1">
              {ITEM_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("type", t)}
                  aria-pressed={form.type === t}
                  className={`rounded-md py-1.5 text-[13px] font-medium transition ${
                    form.type === t ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <Field label="Name" required>
              <input className={inputCls} value={form.name} maxLength={50} onChange={(e) => set("name", e.target.value)} required />
            </Field>
            <Field label="Description" required>
              <input className={inputCls} value={form.description} onChange={(e) => set("description", e.target.value)} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price" required>
                <input
                  className={`${inputCls} tabular`}
                  type="number"
                  min={0}
                  value={form.selling_price}
                  onChange={(e) => set("selling_price", Number(e.target.value) || 0)}
                  required
                />
              </Field>
              <Field label="Unit" required>
                <input
                  className={inputCls}
                  list="units"
                  placeholder="hour, pcs…"
                  value={form.unit}
                  onChange={(e) => set("unit", e.target.value)}
                  required
                />
                <datalist id="units">
                  {["hour", "day", "pcs", "kg", "month"].map((u) => (
                    <option key={u} value={u} />
                  ))}
                </datalist>
              </Field>
            </div>
            <Field label="Tax" required>
              <input
                className={`${inputCls} tabular`}
                type="number"
                min={0}
                value={form.tax}
                onChange={(e) => set("tax", Number(e.target.value) || 0)}
                required
              />
            </Field>
            <button type="submit" disabled={busy} className={`${btnPrimary} w-full`}>
              {busy ? <Spinner inline /> : <Icon name="add" className="text-[18px]" />}
              {busy ? "Adding…" : "Add item"}
            </button>
          </form>
        </Card>
      </div>
    </>
  );
}
