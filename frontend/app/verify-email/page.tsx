"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiErrorMessage } from "@/lib/api";
import { postPublic } from "@/lib/publicApi";
import AuthLayout from "@/components/AuthLayout";
import { ErrorBanner, Field, Spinner, SuccessBanner, btnPrimary, inputCls } from "@/components/ui";

export default function VerifyEmailPage() {
  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Confirm your address to activate your account."
      footer={
        <Link href="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <Suspense fallback={<Spinner label="Verifying…" />}>
        <VerifyEmail />
      </Suspense>
    </AuthLayout>
  );
}

type State = { kind: "verifying" } | { kind: "verified"; message: string } | { kind: "failed"; message: string | null };

function VerifyEmail() {
  const params = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";
  const [state, setState] = useState<State>(
    uid && token ? { kind: "verifying" } : { kind: "failed", message: null }
  );
  const started = useRef(false);

  useEffect(() => {
    // Verify once on load; StrictMode runs effects twice in dev and the second call would fail.
    if (!uid || !token || started.current) return;
    started.current = true;
    postPublic("/auth/verify-email/", { uid, token })
      .then((data) => setState({ kind: "verified", message: data.detail }))
      .catch((err) => setState({ kind: "failed", message: apiErrorMessage(err) }));
  }, [uid, token]);

  if (state.kind === "verifying") return <Spinner label="Verifying your email…" />;

  if (state.kind === "verified") {
    return (
      <>
        <SuccessBanner message={state.message} />
        <Link href="/login" className={`${btnPrimary} h-11 w-full`}>
          Sign in
        </Link>
      </>
    );
  }

  return (
    <>
      <ErrorBanner message={state.message} />
      <ResendForm />
    </>
  );
}

function ResendForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data = await postPublic("/auth/verify-email/resend/", { email });
      setSent(data.detail);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (sent) return <SuccessBanner message={`${sent} Check your inbox (and spam folder).`} />;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-muted">Need a new verification link? Enter the email you signed up with.</p>
      <ErrorBanner message={error} />
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
      <button type="submit" disabled={busy} className={`${btnPrimary} h-11 w-full`}>
        {busy && <Spinner inline />}
        {busy ? "Sending…" : "Resend verification email"}
      </button>
    </form>
  );
}
