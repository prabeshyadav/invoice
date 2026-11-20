"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { apiErrorMessage } from "@/lib/api";
import AuthLayout from "@/components/AuthLayout";
import { ErrorBanner, Field, Spinner, btnPrimary, inputCls } from "@/components/ui";

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
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage your customers and invoices."
      footer={
        <>
          Don&apos;t have an account?{" "}
          <Link href="/register" className="font-medium text-accent hover:underline">
            Create one
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
        <Field label="Password">
          <input
            className={`${inputCls} h-11`}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </Field>
        <button type="submit" disabled={busy} className={`${btnPrimary} h-11 w-full`}>
          {busy && <Spinner inline />}
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
