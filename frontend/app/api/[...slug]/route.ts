/* Backend-for-frontend proxy: forwards /api/* to Django, preserving the
 * trailing slashes Django requires. Same-origin for the browser, so no CORS
 * setup is needed. Point at another backend with the API_URL env var.
 *
 * Auth: the JWT comes from the httpOnly `access` cookie (a client-supplied
 * Authorization header is ignored). On a 401 the `refresh` cookie is used once
 * server-side and the request retried. Token endpoints are not proxied, so a
 * token never reaches browser JavaScript; log in via /api/session/login. */

import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  API_URL,
  REFRESH_COOKIE,
  clearSessionCookies,
  forbidden,
  isSameOrigin,
  refreshAccess,
  setAccessCookie,
} from "@/lib/session";

const BLOCKED = new Set(["auth/token", "auth/token/refresh"]);
const PASSTHROUGH_HEADERS = ["content-type", "content-disposition", "retry-after"];

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const path = slug.join("/");
  if (BLOCKED.has(path)) {
    return NextResponse.json({ detail: "Not found." }, { status: 404 });
  }
  if (!isSameOrigin(request)) return forbidden();

  const target = new URL(`/api/${path}/${request.nextUrl.search}`, API_URL);
  // Buffered once so the request can be replayed after a token refresh.
  const body =
    request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  const contentType = request.headers.get("content-type");

  const send = (access: string | undefined) => {
    const headers = new Headers();
    if (contentType) headers.set("content-type", contentType);
    if (access) headers.set("authorization", `Bearer ${access}`);
    return fetch(target, { method: request.method, headers, body });
  };

  let upstream = await send(request.cookies.get(ACCESS_COOKIE)?.value);
  let refreshedAccess: string | null = null;
  let sessionExpired = false;

  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (upstream.status === 401 && refresh) {
    refreshedAccess = await refreshAccess(refresh);
    if (refreshedAccess) upstream = await send(refreshedAccess);
    else sessionExpired = true;
  }

  const outHeaders = new Headers();
  for (const key of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(key);
    if (value) outHeaders.set(key, value);
  }
  const response = new NextResponse(upstream.body, { status: upstream.status, headers: outHeaders });
  if (refreshedAccess) setAccessCookie(request, response, refreshedAccess);
  if (sessionExpired) clearSessionCookies(request, response);
  return response;
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
