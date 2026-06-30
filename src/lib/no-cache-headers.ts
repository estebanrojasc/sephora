import { PAGE_NO_STORE_HEADERS } from "@/lib/api-response";
import type { NextResponse } from "next/server";

export function applyNoStoreHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(PAGE_NO_STORE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}
