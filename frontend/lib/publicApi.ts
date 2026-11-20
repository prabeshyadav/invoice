/* Unauthenticated auth endpoints (password reset, email verification).
 * Kept separate from apiFetch: these never send or refresh credentials. */

import { ApiError } from "./api";

export async function postPublic<T = { detail: string }>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data);
  return data as T;
}
