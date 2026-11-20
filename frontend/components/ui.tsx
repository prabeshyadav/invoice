import Link from "next/link";
import type { ReactNode } from "react";
import Icon from "./Icon";

/* ── Class tokens ───────────────────────────────────────────────────────── */

const control =
  "h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink outline-none transition placeholder:text-faint hover:border-slate-300 focus:border-accent focus:ring-4 focus:ring-accent/10 disabled:bg-line-soft disabled:text-muted";

export const inputCls = control;
export const selectCls = `${control} cursor-pointer pr-8`;
export const textareaCls = control.replace("h-10", "min-h-24 py-2");

const btn =
  "inline-flex h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-4 text-sm font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50";

export const btnPrimary = `${btn} bg-accent text-white shadow-sm shadow-accent/20 hover:bg-accent-dark`;
export const btnSecondary = `${btn} border border-line bg-white text-ink-2 shadow-sm hover:border-slate-300 hover:bg-slate-50`;
export const btnGhost = `${btn} text-muted hover:bg-slate-100 hover:text-ink`;
export const btnDanger = `${btn} border border-red-200 bg-white text-danger hover:border-red-300 hover:bg-red-50`;

export const card = "rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

/* ── Layout ─────────────────────────────────────────────────────────────── */

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-ink"
        >
          <Icon name="arrow_back" className="text-[16px]" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className = "",
  padded = true,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={`${card} ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
          <div>
            {title && <h2 className="text-[15px] font-semibold text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      <div className={padded ? "p-5" : ""}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-faint">{hint}</span>}
    </label>
  );
}

/* ── Feedback ───────────────────────────────────────────────────────────── */

function Banner({
  message,
  tone,
}: {
  message: string | null;
  tone: "error" | "success";
}) {
  if (!message) return null;
  const styles =
    tone === "error"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`mb-5 flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm ${styles}`}>
      <Icon name={tone === "error" ? "error" : "check_circle"} className="mt-px text-[18px]" />
      <p>{message}</p>
    </div>
  );
}

export const ErrorBanner = ({ message }: { message: string | null }) => (
  <Banner message={message} tone="error" />
);
export const SuccessBanner = ({ message }: { message: string | null }) => (
  <Banner message={message} tone="success" />
);

export function Spinner({ label = "Loading…", inline = false }: { label?: string; inline?: boolean }) {
  const ring = <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
  if (inline) return ring;
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted" role="status">
      <span className="h-7 w-7 animate-spin rounded-full border-[3px] border-line border-t-accent" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon name={icon} className="text-[24px]" />
      </div>
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ── Data display ───────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, { cls: string; label: string }> = {
  paid: { cls: "bg-emerald-50 text-emerald-700 ring-emerald-600/20", label: "Paid" },
  sent: { cls: "bg-blue-50 text-blue-700 ring-blue-600/20", label: "Sent" },
  draft: { cls: "bg-slate-100 text-slate-600 ring-slate-500/20", label: "Draft" },
  overdue: { cls: "bg-red-50 text-red-700 ring-red-600/20", label: "Overdue" },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

const AVATAR_COLORS = [
  "bg-indigo-100 text-indigo-700",
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
  "bg-violet-100 text-violet-700",
];

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
  const hash = [...name].reduce((h, ch) => h + ch.charCodeAt(0), 0);
  const color = AVATAR_COLORS[hash % AVATAR_COLORS.length];
  const dims = { sm: "h-7 w-7 text-[11px]", md: "h-9 w-9 text-xs", lg: "h-14 w-14 text-lg" }[size];
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${dims} ${color}`}>
      {initials || "?"}
    </span>
  );
}

export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = "accent",
  href,
}: {
  label: string;
  value: ReactNode;
  icon: string;
  hint?: ReactNode;
  tone?: "accent" | "success" | "warning" | "danger";
  href?: string;
}) {
  const toneCls = {
    accent: "bg-accent-soft text-accent",
    success: "bg-emerald-50 text-success",
    warning: "bg-amber-50 text-warning",
    danger: "bg-red-50 text-danger",
  }[tone];
  const inner = (
    <div className={`${card} h-full p-5 transition ${href ? "hover:border-slate-300 hover:shadow-md" : ""}`}>
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted">{label}</p>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneCls}`}>
          <Icon name={icon} className="text-[18px]" />
        </span>
      </div>
      <p className="tabular mt-3 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export const th = "px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-faint";
export const td = "px-5 py-3.5 text-sm";
export const trLink = "cursor-pointer border-t border-line-soft transition-colors hover:bg-slate-50/80";

export function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative w-full sm:max-w-xs">
      <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-faint" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`${inputCls} pl-9`}
      />
    </div>
  );
}
