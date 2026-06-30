import { NextResponse } from "next/server";

/** Evita respuestas 304 / caché CDN en datos dinámicos (MongoDB). */
export const API_NO_STORE_HEADERS = {
  "Cache-Control":
    "private, no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0",
  Pragma: "no-cache",
  Expires: "0",
  "Surrogate-Control": "no-store",
  "CDN-Cache-Control": "no-store",
  "Vercel-CDN-Cache-Control": "no-store",
  Vary: "Cookie, RSC, Next-Router-Prefetch, Next-Router-State-Tree",
} as const;

/** Cabeceras para páginas admin / RSC (evita 304 en segment cache de Vercel). */
export const PAGE_NO_STORE_HEADERS = API_NO_STORE_HEADERS;

export function jsonNoStore<T>(body: T, init?: ResponseInit): NextResponse {
  const headers = new Headers(init?.headers);
  for (const [key, value] of Object.entries(API_NO_STORE_HEADERS)) {
    headers.set(key, value);
  }
  return NextResponse.json(body, { ...init, headers });
}
