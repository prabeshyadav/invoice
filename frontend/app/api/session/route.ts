import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  USERNAME_COOKIE,
  clearSessionCookies,
  refreshAccess,
  setAccessCookie,
} from "@/lib/session";

/* Lets the client bootstrap auth state without reading any token. An expired
 * access cookie is renewed here so the first API call doesn't bounce. */
export async function GET(request: NextRequest) {
  const username = request.cookies.get(USERNAME_COOKIE)?.value ?? null;
  if (request.cookies.get(ACCESS_COOKIE)?.value && username) {
    return NextResponse.json({ authenticated: true, username });
  }

  const access = await refreshAccess(request, request.cookies.get(REFRESH_COOKIE)?.value);
  if (access && username) {
    const response = NextResponse.json({ authenticated: true, username });
    setAccessCookie(request, response, access);
    return response;
  }

  const response = NextResponse.json({ authenticated: false, username: null });
  clearSessionCookies(request, response);
  return response;
}
