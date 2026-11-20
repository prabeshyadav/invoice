"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { apiErrorMessage } from "@/lib/api";
import { postPublic } from "@/lib/publicApi";
import AuthLayout from "@/components/AuthLayout";
import { ErrorBanner, Field, Spinner, SuccessBanner, btnPrimary, inputCls } from "@/components/ui";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data = await postPublic("/auth/password-reset/", { email });
      setSent(data.detail);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your account email and we'll send you a link to reset it."
      footer={
        <>
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <SuccessBanner message={`${sent} Check your inbox (and spam folder).`} />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <ErrorBanner message={error} />
          <Field label="Email">
            <input
              className={`${inputCls} h-11`}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              autoComplete="email"
            />
          </Field>
          <button type="submit" disabled={busy} className={`${btnPrimary} h-11 w-full`}>
            {busy && <Spinner inline />}
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
