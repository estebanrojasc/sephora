import { jsonNoStore } from "@/lib/api-response";

export function mongoErrorResponse(err: unknown, route: string) {
  console.error(`[${route}]`, err);
  const hasUri = Boolean(process.env.MONGODB_URI?.trim());
  const raw = err instanceof Error ? err.message : String(err);
  const isTimeout =
    /timed out|timeout|Server selection|ETIMEDOUT|ECONNREFUSED/i.test(raw);

  let message: string;
  if (!hasUri) {
    message =
      "MONGODB_URI no está configurada en Vercel (Settings → Environment Variables).";
  } else if (isTimeout) {
    message =
      "Timeout al conectar con MongoDB Atlas. Revisa: Network Access (0.0.0.0/0), usuario/contraseña, y que el cluster no esté pausado.";
  } else {
    message = "No se pudo conectar a la base de datos.";
  }

  return jsonNoStore({ message, detail: raw.slice(0, 200) }, { status: 503 });
}
