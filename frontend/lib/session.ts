/* Server-only helpers for the backend-for-frontend session. JWTs live in
 * httpOnly cookies set here; browser JavaScript never sees a token. Used by
 * app/api/session/* and the app/api/[...slug] proxy. */

import "server-only";
import type { NextRequest, NextResponse } from "next/server";

export const API_URL = process.env.API_URL ?? "http://127.0.0.1:8001";

export const ACCESS_COOKIE = "access";
export const REFRESH_COOKIE = "refresh";
export const USERNAME_COOKIE = "username";

/* Mirror SIMPLE_JWT lifetimes in invoice/settings.py. */
const ACCESS_MAX_AGE = 60 * 60;
const REFRESH_MAX_AGE = 7 * 24 * 60 * 60;

/* Secure cookies are not stored over plain http by every browser (Safari on
 * http://127.0.0.1), so mark them Secure only when the request arrived over
 * https (directly or via a TLS-terminating proxy), or when forced. */
function isSecure(request: NextRequest): boolean {
  if (process.env.COOKIE_SECURE === "true") return true;
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  return (proto ?? request.nextUrl.protocol.replace(":", "")) === "https";
}

function cookieOptions(request: NextRequest, maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isSecure(request),
    path: "/",
    maxAge,
  };
}

export function setAccessCookie(request: NextRequest, response: NextResponse, access: string) {
  response.cookies.set(ACCESS_COOKIE, access, cookieOptions(request, ACCESS_MAX_AGE));
}

export function setSessionCookies(
  request: NextRequest,
  response: NextResponse,
  tokens: { access: string; refresh: string; username: string }
) {
  setAccessCookie(request, response, tokens.access);
  response.cookies.set(REFRESH_COOKIE, tokens.refresh, cookieOptions(request, REFRESH_MAX_AGE));
  response.cookies.set(USERNAME_COOKIE, tokens.username, cookieOptions(request, REFRESH_MAX_AGE));
}

export function clearSessionCookies(request: NextRequest, response: NextResponse) {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, USERNAME_COOKIE]) {
    response.cookies.set(name, "", cookieOptions(request, 0));
  }
}

/* CSRF: cookies are sent automatically, so state-changing requests must come
 * from our own origin. Browsers always send Origin on cross-site POST/PUT/
 * PATCH/DELETE; Referer is the fallback. Missing both is rejected. */
export function isSameOrigin(request: NextRequest): boolean {
  if (request.method === "GET" || request.method === "HEAD") return true;
  const source = request.headers.get("origin") ?? request.headers.get("referer");
  if (!source) return false;
  const host = request.headers.get("x-forwarded-host")?.split(",")[0].trim() ?? request.headers.get("host");
  try {
    return new URL(source).host === host;
  } catch {
    return false;
  }
}

export function forbidden(): Response {
  return Response.json({ detail: "Cross-site request rejected." }, { status: 403 });
}

/* Headers for a server-side call to Django on behalf of `request`. Django
 * throttles by client IP, and without this every user would share the Next.js
 * server's address. Next.js fills x-forwarded-for from the socket when the
 * incoming request has none, and keeps the value a TLS reverse proxy set;
 * Django trusts only its last entry (TRUSTED_PROXY_COUNT). */
export function backendHeaders(request: NextRequest, init?: HeadersInit): Headers {
  const headers = new Headers(init);
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) headers.set("x-forwarded-for", forwardedFor);
  return headers;
}

/* Exchanges the refresh cookie for a new access token, or null. */
export async function refreshAccess(
  request: NextRequest,
  refresh: string | undefined
): Promise<string | null> {
  if (!refresh) return null;
  const res = await fetch(new URL("/api/auth/token/refresh/", API_URL), {
    method: "POST",
    headers: backendHeaders(request, { "content-type": "application/json" }),
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { access?: string };
  return data.access ?? null;
}
