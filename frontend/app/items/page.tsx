"use client";

import { useEffect, useState, type FormEvent } from "react";
import { RequireAuth } from "@/lib/auth";
import { ITEM_TYPES, apiErrorMessage, apiFetch, formatMoney, formatPercent, listAll, type CatalogItem } from "@/lib/api";
import Icon from "@/components/Icon";
import ConfirmModal from "@/components/ConfirmModal";
import { useToast } from "@/lib/toast";
import {
  Card,
  EmptyState,
  ErrorBanner,
  Field,
  PageHeader,
  SearchInput,
  Spinner,
  btnPrimary,
  btnSecondary,
  inputCls,
  td,
  th,
} from "@/components/ui";

const EMPTY = { type: "Services", name: "", description: "", selling_price: 0, tax_rate: 0, unit: "" };

export default function ItemsPage() {
  return (
    <RequireAuth>
      <ItemsBody />
    </RequireAuth>
  );
}

function ItemsBody() {
  const toast = useToast();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<CatalogItem | null>(null);
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

  function startEdit(item: CatalogItem) {
    setEditingItem(item);
    setForm({
      type: item.type || "Services",
      name: item.name,
      description: item.description,
      selling_price: Number(item.selling_price) || 0,
      tax_rate: Number(item.tax_rate) || 0,
      unit: item.unit,
    });
    setError(null);
  }

  function cancelEdit() {
    setEditingItem(null);
    setForm(EMPTY);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (editingItem) {
        const updated = await apiFetch<CatalogItem>(`/items/${editingItem.id}/`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
        setItems((xs) => xs.map((x) => (x.id === updated.id ? updated : x)));
        toast.success(`Updated "${updated.name}".`);
        cancelEdit();
      } else {
        const created = await apiFetch<CatalogItem>("/items/", { method: "POST", body: JSON.stringify(form) });
        setItems((xs) => [created, ...xs]);
        toast.success(`Added "${created.name}" to catalog.`);
        setForm(EMPTY);
      }
    } catch (err) {
      const msg = apiErrorMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deletingItem) return;
    setBusy(true);
    try {
      await apiFetch(`/items/${deletingItem.id}/`, { method: "DELETE" });
      setItems((xs) => xs.filter((x) => x.id !== deletingItem.id));
      toast.success(`Deleted "${deletingItem.name}".`);
      if (editingItem?.id === deletingItem.id) cancelEdit();
      setDeletingItem(null);
    } catch (e) {
      const msg = apiErrorMessage(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;

  const q = search.trim().toLowerCase();
  const filtered = items.filter((it) => !q || it.name.toLowerCase().includes(q) || it.description.toLowerCase().includes(q));

  return (
    <>
      <PageHeader title="Items" subtitle="Reusable goods and services you can add to invoices in one click." />
      <ErrorBanner message={error} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
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
              description={items.length ? "Try a different search term or clear the filter." : "Add products or services you bill often."}
              action={
                search ? (
                  <button type="button" onClick={() => setSearch("")} className={btnSecondary}>
                    Clear search
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead>
                  <tr>
                    <th className={th}>Item</th>
                    <th className={th}>Type</th>
                    <th className={`${th} text-right`}>Price</th>
                    <th className={`${th} text-right`}>Tax %</th>
                    <th className={`${th} text-right`}>Actions</th>
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
                      <td className={`${td} tabular text-right text-muted`}>{formatPercent(it.tax_rate)}</td>
                      <td className={`${td} text-right`}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => startEdit(it)}
                            title="Edit item"
                            aria-label={`Edit ${it.name}`}
                            className="rounded-md p-1.5 text-faint transition hover:bg-slate-100 hover:text-ink"
                          >
                            <Icon name="edit" className="text-[18px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingItem(it)}
                            title="Delete item"
                            aria-label={`Delete ${it.name}`}
                            className="rounded-md p-1.5 text-faint transition hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Icon name="delete" className="text-[18px]" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={editingItem ? "Edit item" : "New item"} className="order-1 h-fit xl:order-2">
          <form onSubmit={onSubmit} className="space-y-4">
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
                  step="0.01"
                  value={form.selling_price}
                  onChange={(e) => set("selling_price", Math.max(0, Number(e.target.value) || 0))}
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
            <Field label="Tax %" required>
              <input
                className={`${inputCls} tabular`}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={form.tax_rate}
                onChange={(e) => set("tax_rate", Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                required
              />
            </Field>
            <div className="flex gap-2">
              {editingItem && (
                <button type="button" onClick={cancelEdit} className={`${btnSecondary} flex-1`}>
                  Cancel
                </button>
              )}
              <button type="submit" disabled={busy} className={`${btnPrimary} flex-1`}>
                {busy ? <Spinner inline /> : <Icon name={editingItem ? "check" : "add"} className="text-[18px]" />}
                {busy ? "Saving…" : editingItem ? "Save changes" : "Add item"}
              </button>
            </div>
          </form>
        </Card>
      </div>

      <ConfirmModal
        isOpen={!!deletingItem}
        title="Delete catalog item"
        description={
          <>
            Are you sure you want to delete <strong className="text-ink">{deletingItem?.name}</strong> from your
            catalog? This won&apos;t change past invoices that used this item.
          </>
        }
        confirmText="Delete item"
        busy={busy}
        onConfirm={confirmDelete}
        onClose={() => setDeletingItem(null)}
      />
    </>
  );
}
