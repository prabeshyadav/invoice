"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/api";
import Icon from "@/components/Icon";
import { ErrorBanner, btnLogin } from "@/components/ui";

const addonInput =
  "h-[46px] w-full rounded-r-xl border border-l-0 border-[#e2e8f0] bg-white px-3 text-[13px] text-[#0f172a] outline-none transition-all placeholder:text-[#94a3b8] hover:border-accent focus:border-accent focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]";

function InputAddon({
  icon,
  children,
}: {
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex">
      <span className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-l-xl border border-r-0 border-[#e2e8f0] bg-[#f8fafc] text-[#94a3b8]">
        <Icon name={icon} className="text-[18px]" />
      </span>
      {children}
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(username, password);
      router.replace("/");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-[#f8fafc] via-[#eef2ff] to-[#f8fafc]">
      {/* Top nav */}
      <nav className="flex h-[60px] items-center justify-between border-b border-[#e2e8f0] bg-white/80 px-6 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent">
            <Icon name="lab_profile" className="text-white text-[16px]" />
          </div>
          <span className="text-[15px] font-semibold text-[#0f172a]">InvoicePro</span>
        </div>
        <div className="flex items-center gap-1 text-[13px] text-[#64748b]">
          <span>Don&apos;t have an account?</span>
          <Link href="/register" className="font-semibold text-accent hover:underline">
            &nbsp;Register
          </Link>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-[400px] animate-fade-in">
          {/* Card */}
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-8 shadow-xl shadow-black/5">
            {/* Header */}
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10">
                <Icon name="lab_profile" className="text-[24px] text-accent" />
              </div>
              <h1 className="text-[22px] font-bold text-[#0f172a]">Welcome back</h1>
              <p className="mt-1 text-[13px] text-[#64748b]">
                Sign in to your InvoicePro account
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-1">
              <ErrorBanner message={error} />

              <div className="space-y-1">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                  Username
                </label>
                <InputAddon icon="person">
                  <input
                    className={addonInput}
                    placeholder="Enter your username"
                    aria-label="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </InputAddon>
              </div>

              <div className="space-y-1">
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#64748b]">
                  Password
                </label>
                <InputAddon icon="lock">
                  <input
                    className={addonInput}
                    type="password"
                    placeholder="Enter your password"
                    aria-label="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </InputAddon>
              </div>

              <div className="flex justify-end pb-1">
                <button
                  type="button"
                  className="text-[12px] font-medium text-accent hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <button type="submit" disabled={busy} className={btnLogin}>
                {busy ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Signing in…
                  </span>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <p className="mt-6 text-center text-[12px] text-[#94a3b8]">
              Having trouble?{" "}
              <button className="font-medium text-accent hover:underline">
                Get help
              </button>
            </p>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-[12px] text-[#94a3b8]">
            © {new Date().getFullYear()} InvoicePro. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
