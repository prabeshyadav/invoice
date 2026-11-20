"use client";

import { Suspense, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiErrorMessage } from "@/lib/api";
import { postPublic } from "@/lib/publicApi";
import AuthLayout from "@/components/AuthLayout";
import { ErrorBanner, Field, Spinner, SuccessBanner, btnPrimary, inputCls } from "@/components/ui";

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Pick a password you don't use anywhere else."
      footer={
        <Link href="/login" className="font-medium text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      <Suspense fallback={<Spinner />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}

function ResetPasswordForm() {
  const params = useSearchParams();
  const uid = params.get("uid") ?? "";
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!uid || !token) {
    return (
      <ErrorBanner message="This reset link is incomplete. Open the link from your email again, or request a new one." />
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const data = await postPublic("/auth/password-reset/confirm/", { uid, token, new_password: password });
      setDone(data.detail);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <>
        <SuccessBanner message={done} />
        <Link href="/login" className={`${btnPrimary} h-11 w-full`}>
          Sign in
        </Link>
      </>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <ErrorBanner message={error} />
      {error?.toLowerCase().includes("expired") && (
        <p className="-mt-2 text-sm text-muted">
          <Link href="/forgot-password" className="font-medium text-accent hover:underline">
            Request a new reset link
          </Link>
        </p>
      )}
      <Field label="New password" hint="At least 8 characters, not too common or all numbers.">
        <input
          className={`${inputCls} h-11`}
          type="password"
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirm new password">
        <input
          className={`${inputCls} h-11`}
          type="password"
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
        />
      </Field>
      <button type="submit" disabled={busy} className={`${btnPrimary} h-11 w-full`}>
        {busy && <Spinner inline />}
        {busy ? "Saving…" : "Reset password"}
      </button>
    </form>
  );
}
