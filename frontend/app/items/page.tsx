"use client";

import { useEffect, useState, type FormEvent } from "react";
import { RequireAuth } from "@/lib/auth";
import {
  ITEM_TYPES,
  apiErrorMessage,
  apiFetch,
  listAll,
  type CatalogItem,
} from "@/lib/api";
import {
  ErrorBanner,
  Field,
  PageTitle,
  Spinner,
  btnDanger,
  btnPrimary,
  inputCls,
} from "@/components/ui";

const EMPTY = {
  type: "",
  name: "",
  description: "",
  selling_price: 0,
  tax: 0,
  unit: "",
};

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

  async function reload() {
    try {
      setItems(await listAll<CatalogItem>("/items/"));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    listAll<CatalogItem>("/items/")
      .then(setItems)
      .catch((e) => setError(apiErrorMessage(e)))
      .finally(() => setLoading(false));
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch("/items/", { method: "POST", body: JSON.stringify(form) });
      setForm(EMPTY);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number) {
    if (!confirm("Delete this item?")) return;
    try {
      await apiFetch(`/items/${id}/`, { method: "DELETE" });
      setItems((xs) => xs.filter((x) => x.id !== id));
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }

  if (loading) return <Spinner />;
  return (
    <div className="max-w-3xl">
      <PageTitle title="Catalog items" />
      <ErrorBanner message={error} />
      <form
        onSubmit={onCreate}
        className="mb-8 grid grid-cols-2 gap-3 rounded-md border border-line bg-panel p-4"
      >
        <Field label="Type">
          <select
            className={inputCls}
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="">—</option>
            {ITEM_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name">
          <input
            className={inputCls}
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
        </Field>
        <Field label="Description">
          <input
            className={inputCls}
            value={form.description}
            onChange={(e) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
            required
          />
        </Field>
        <Field label="Unit">
          <input
            className={inputCls}
            value={form.unit}
            onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            required
          />
        </Field>
        <Field label="Selling price">
          <input
            className={inputCls}
            type="number"
            value={form.selling_price}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                selling_price: Number(e.target.value) || 0,
              }))
            }
            required
          />
        </Field>
        <Field label="Tax">
          <input
            className={inputCls}
            type="number"
            value={form.tax}
            onChange={(e) =>
              setForm((f) => ({ ...f, tax: Number(e.target.value) || 0 }))
            }
            required
          />
        </Field>
        <div className="col-span-2">
          <button type="submit" disabled={busy} className={btnPrimary}>
            {busy ? "Adding…" : "Add item"}
          </button>
        </div>
      </form>
      {items.length === 0 ? (
        <p className="text-sm text-[#999]">No catalog items yet.</p>
      ) : (
        <ul className="divide-y divide-line rounded-md border border-line bg-white">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-panel"
            >
              <div>
                <p className="font-medium">{it.name}</p>
                <p className="text-sm text-[#999]">
                  {it.type} · {it.unit} · {it.selling_price} (+{it.tax} tax)
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(it.id)}
                className={btnDanger}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
