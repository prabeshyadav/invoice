import type { ReactNode } from "react";
import Icon from "./Icon";
import { Logo } from "./AppShell";

const FEATURES = [
  { icon: "receipt_long", text: "Line-itemed invoices with auto numbering" },
  { icon: "picture_as_pdf", text: "One-click PDF export and email delivery" },
  { icon: "insights", text: "See what's paid, outstanding and overdue" },
];

export default function AuthLayout({
  title,
  subtitle,
  footer,
  children,
}: {
  title: string;
  subtitle: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-violet-400/20 blur-3xl" />
        <div className="relative flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
            <Icon name="receipt_long" className="text-[20px]" />
          </span>
          <span className="text-lg font-semibold">InvoicePro</span>
        </div>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Get paid faster with invoices that look the part.</h2>
          <ul className="mt-8 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.icon} className="flex items-center gap-3 text-indigo-100">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
                  <Icon name={f.icon} className="text-[18px] text-white" />
                </span>
                {f.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-16 text-sm text-indigo-200">© {new Date().getFullYear()} InvoicePro</p>
      </div>

      <div className="flex items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm animate-fade-in">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
          <div className="mt-8">{children}</div>
          <p className="mt-8 text-center text-sm text-muted">{footer}</p>
        </div>
      </div>
    </div>
  );
}
