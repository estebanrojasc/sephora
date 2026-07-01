import { connection } from "next/server";
import { cookies, headers } from "next/headers";
import { unstable_noStore as noStore } from "next/cache";

/** Fuerza render dinámico del segmento (evita Full Route Cache con payload vacío). */
export async function ensureAdminDynamicRender(): Promise<void> {
  noStore();
  await connection();
  await headers();
  await cookies();
}

/** Marca única por request para invalidar ETag / segment cache obsoleto. */
export function adminRenderNonce(): number {
  return Date.now();
}
