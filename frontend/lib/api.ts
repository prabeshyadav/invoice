/* Typed client for the Django REST API. All calls go to same-origin /api/*,
 * which app/api/[...slug]/route.ts proxies to Django. */

export const INVOICE_STATUSES = ["draft", "sent", "paid"] as const;
export const CUSTOMER_TYPES = ["business", "individual"];
export const SALUTATIONS = ["Mr.", "Mrs.", "Miss.", "Ms.", "Dr."];
export const CURRENCIES = ["NPR-Nepales", "AUD", "CAD", "CNI"];
export const LANGUAGES = ["ENGLISH", "NEPALI"];
export const ITEM_TYPES = ["Goods", "Services"];

export interface Customer {
  id: number;
  customer_type: string;
  primary_contact: string;
  first_name: string;
  last_name: string;
  company_name: string;
  customer_display_name: string;
  currency: string;
  individual_name: string;
  email: string;
  phone: string;
  website: string;
  mobile: string;
  Portal_Language: string;
  facebook: string;
  twitter: string;
}

export interface LineItem {
  id: number;
  invoice: number;
  items_details: string;
  quantity: string;
  rate: string;
  amount: string;
}

export interface Invoice {
  id: number;
  customer_name: number;
  customer_display_name: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  subject: string;
  status: string;
  discount_percent: string;
  tax_percent: string;
  line_items: LineItem[];
  /* Money fields are Decimal strings from DRF ("12.50"); use Number()/formatMoney. */
  sub_total: string;
  discount_amount: string;
  /* Sub total after discount, before tax. */
  discounted_total_amount: string;
  tax_amount: string;
  total: string;
}

export interface CatalogItem {
  id: number;
  type: string;
  name: string;
  description: string;
  selling_price: string;
  tax_rate: string;
  unit: string;
}

interface Page<T> {
  count: number;
  next: string | null;
  results: T[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown
  ) {
    super(`Request failed (${status})`);
  }
}

/* Called when the session can no longer be refreshed (set by AuthProvider). */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

/* Tokens live in httpOnly cookies managed by the Next.js proxy
 * (app/api/[...slug]/route.ts), which also refreshes them; the browser only
 * sends same-origin requests with cookies. */
export async function apiFetchRaw(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(`/api${path}`, { ...init, headers, credentials: "same-origin" });
  if (res.status === 401) onUnauthorized();
  return res;
}

export async function apiFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await apiFetchRaw(path, init);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}

/* Follows DRF pagination. `next` is an absolute backend URL, so keep only
 * the path after /api and the query string. */
export async function listAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let next: string | null = path;
  while (next) {
    const page: Page<T> = await apiFetch<Page<T>>(next);
    out.push(...page.results);
    if (!page.next) break;
    const u = new URL(page.next);
    next = u.pathname.replace(/^\/api/, "") + u.search;
  }
  return out;
}

export function apiErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const d = e.data;
    if (d && typeof d === "object") {
      const obj = d as Record<string, unknown>;
      if (typeof obj.detail === "string") return obj.detail;
      const parts = Object.entries(obj).map(([k, v]) => {
        const msg = Array.isArray(v) ? v.join(" ") : String(v);
        return k === "non_field_errors" ? msg : `${k.replace(/_/g, " ")}: ${msg}`;
      });
      if (parts.length) return parts.join(" · ");
    }
    return e.message;
  }
  return e instanceof Error ? e.message : "Something went wrong.";
}

/* ── Formatting helpers ─────────────────────────────────────────────────── */

export function formatMoney(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* Round to cents, half up, like the backend (live previews only; the API is authoritative). */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON * Math.max(1, Math.abs(n))) * 100) / 100;
}

export function formatPercent(value: number | string | null | undefined): string {
  return `${Number(value ?? 0)}%`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function isOverdue(inv: Pick<Invoice, "status" | "due_date">): boolean {
  if (inv.status === "paid") return false;
  return new Date(`${inv.due_date}T23:59:59`) < new Date();
}

/* Display status: "overdue" is derived, not stored. */
export function displayStatus(inv: Pick<Invoice, "status" | "due_date">): string {
  if (isOverdue(inv)) return "overdue";
  return inv.status || "draft";
}

export function customerName(c: Pick<Customer, "customer_display_name" | "first_name" | "last_name">): string {
  return c.customer_display_name || `${c.first_name} ${c.last_name}`.trim();
}
