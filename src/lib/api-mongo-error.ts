import { jsonNoStore } from "@/lib/api-response";

export function mongoErrorResponse(err: unknown, route: string) {
  console.error(`[${route}]`, err);
  const hasUri = Boolean(process.env.MONGODB_URI?.trim());
  const message = hasUri
    ? "No se pudo conectar a la base de datos. Reintenta en unos segundos."
    : "MONGODB_URI no está configurada en el servidor (Vercel → Environment Variables).";
  return jsonNoStore({ message }, { status: 503 });
}
