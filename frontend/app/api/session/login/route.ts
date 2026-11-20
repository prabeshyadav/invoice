import { NextResponse, type NextRequest } from "next/server";
import { API_URL, backendHeaders, forbidden, isSameOrigin, setSessionCookies } from "@/lib/session";

/* Exchanges credentials for JWTs server-side and stores them in httpOnly
 * cookies. Django's error status and body (401, 429, …) pass through. */
export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return forbidden();

  const body = (await request.json().catch(() => ({}))) as { username?: string; password?: string };
  const upstream = await fetch(new URL("/api/auth/token/", API_URL), {
    method: "POST",
    headers: backendHeaders(request, { "content-type": "application/json" }),
    body: JSON.stringify({ username: body.username, password: body.password }),
  });
  const data = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    const headers = new Headers();
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) headers.set("retry-after", retryAfter);
    return NextResponse.json(data, { status: upstream.status, headers });
  }

  const username = String(body.username);
  const response = NextResponse.json({ authenticated: true, username });
  setSessionCookies(request, response, { access: data.access, refresh: data.refresh, username });
  return response;
}
