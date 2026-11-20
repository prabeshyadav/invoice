import { NextResponse, type NextRequest } from "next/server";
import { clearSessionCookies, forbidden, isSameOrigin } from "@/lib/session";

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return forbidden();
  const response = NextResponse.json({ authenticated: false });
  clearSessionCookies(request, response);
  return response;
}
