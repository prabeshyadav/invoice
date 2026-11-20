"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/api";
import AuthLayout from "@/components/AuthLayout";
import Icon from "@/components/Icon";
import { ErrorBanner, Field, Spinner, btnPrimary, btnSecondary, inputCls } from "@/components/ui";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { verificationRequired } = await register(username, email, password);
      if (verificationRequired) {
        setPendingEmail(email);
        setBusy(false);
        return;
      }
      router.replace("/");
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(false);
    }
  }

  if (pendingEmail) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle="One more step to activate your account."
        footer={
          <>
            Already verified?{" "}
            <Link href="/login" className="font-medium text-accent hover:underline">
              Sign in
            </Link>
          </>
        }
      >
        <div className="rounded-xl border border-line bg-slate-50 p-5 text-sm text-ink-2">
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
            <Icon name="mark_email_unread" className="text-[22px]" />
          </span>
          We sent a verification link to <strong className="text-ink">{pendingEmail}</strong>. Open it to activate
          your account, then sign in.
        </div>
        <Link href="/verify-email" className={`${btnSecondary} mt-4 h-11 w-full`}>
          Didn&apos;t get it? Resend the link
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start invoicing in under a minute."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <ErrorBanner message={error} />
        <Field label="Username">
          <input
            className={`${inputCls} h-11`}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
            autoComplete="username"
          />
        </Field>
        <Field label="Email">
          <input
            className={`${inputCls} h-11`}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </Field>
        <Field label="Password" hint="At least 8 characters, not too common or all numbers.">
          <input
            className={`${inputCls} h-11`}
            type="password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
        </Field>
        <button type="submit" disabled={busy} className={`${btnPrimary} h-11 w-full`}>
          {busy && <Spinner inline />}
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
