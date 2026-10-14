import type { ReactNode } from "react";

/* ── Design tokens ──────────────────────────────────────────────────────── */

export const inputCls =
  "h-[38px] w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-[13px] text-[#0f172a] outline-none transition-all duration-150 placeholder:text-[#94a3b8] hover:border-accent focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]";

export const selectCls =
  "h-[38px] w-full rounded-xl border border-[#e2e8f0] bg-white px-3 text-[13px] text-[#0f172a] outline-none transition-all duration-150 hover:border-accent focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)] cursor-pointer";

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-all duration-150 hover:bg-accent-dark hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]";

export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#e2e8f0] bg-white px-4 py-2 text-[13px] font-medium text-[#475569] shadow-sm transition-all duration-150 hover:bg-[#f8fafc] hover:border-[#cbd5e1] disabled:opacity-50 active:scale-[0.98]";

export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-xl bg-red-500 px-4 py-2 text-[13px] font-medium text-white shadow-sm transition-all duration-150 hover:bg-red-600 disabled:opacity-50 active:scale-[0.98]";

export const btnLogin =
  "h-[46px] w-full rounded-xl bg-accent text-[14px] font-semibold text-white shadow-md shadow-accent/30 transition-all duration-150 hover:bg-accent-dark hover:shadow-lg hover:shadow-accent/40 disabled:opacity-50 active:scale-[0.98]";

export const rowHover =
  "transition-colors duration-100 hover:bg-[#f8fafc] cursor-pointer";

export const listWrap =
  "divide-y divide-[#f1f5f9] rounded-2xl border border-[#e2e8f0] bg-white shadow-sm overflow-hidden";

/* ── Components ─────────────────────────────────────────────────────────── */

export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-[#0f172a]">{title}</h1>
        {subtitle && (
          <p className="mt-0.5 text-[12px] text-[#64748b]">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
      <span className="mt-0.5 text-red-500 text-[15px]">⚠</span>
      <p className="text-[13px] text-red-700">{message}</p>
    </div>
  );
}

export function SuccessBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
      <span className="mt-0.5 text-emerald-500 text-[15px]">✓</span>
      <p className="text-[13px] text-emerald-700">{message}</p>
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="h-8 w-8 rounded-full border-[3px] border-[#e2e8f0] border-t-accent animate-spin" />
      <p className="text-[13px] text-[#94a3b8]">{label}</p>
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-[11px] text-[#94a3b8]">{hint}</span>
      )}
    </label>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  href,
}: {
  label: string;
  value: string | number;
  icon?: string;
  trend?: string;
  href?: string;
}) {
  const inner = (
    <div className="group relative overflow-hidden rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold text-[#0f172a]">{value}</p>
          {trend && <p className="mt-1 text-[11px] text-[#94a3b8]">{trend}</p>}
        </div>
        {icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
            <span className="material-symbols-outlined text-[20px] text-accent">
              {icon}
            </span>
          </div>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-accent/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
    </div>
  );

  if (href) {
    const Link = require("next/link").default;
    return <Link href={href}>{inner}</Link>;
  }
  return inner;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f1f5f9]">
          <span className="material-symbols-outlined text-[28px] text-[#94a3b8]">
            {icon}
          </span>
        </div>
      )}
      <p className="text-[15px] font-medium text-[#0f172a]">{title}</p>
      {description && (
        <p className="mt-1 text-[13px] text-[#64748b]">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
