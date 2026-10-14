/* Backend-for-frontend proxy: forwards /api/* to Django, preserving the
 * trailing slashes Django requires. Same-origin for the browser, so no CORS
 * setup is needed. Point at another backend with the API_URL env var. */

import type { NextRequest } from "next/server";

const API_URL = process.env.API_URL ?? "http://127.0.0.1:8001";

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const incoming = new URL(request.url);
  const target = new URL(`/api/${slug.join("/")}/${incoming.search}`, API_URL);

  const headers = new Headers();
  const auth = request.headers.get("authorization");
  if (auth) headers.set("authorization", auth);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  let body: BodyInit | undefined;
  if (request.method !== "GET" && request.method !== "HEAD") {
    body = await request.arrayBuffer();
  }

  const upstream = await fetch(target, {
    method: request.method,
    headers,
    body,
  });

  const outHeaders = new Headers();
  for (const key of ["content-type", "content-disposition"]) {
    const value = upstream.headers.get(key);
    if (value) outHeaders.set(key, value);
  }
  return new Response(upstream.body, {
    status: upstream.status,
    headers: outHeaders,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
