import { jsonNoStore } from "@/lib/api-response";
import { runSystemHealthCheck } from "@/lib/health-check";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Diagnóstico completo: Mongo, conteos, variables de entorno. */
export async function GET() {
  try {
    const report = await runSystemHealthCheck();
    return jsonNoStore(report, { status: report.ok ? 200 : 503 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonNoStore(
      {
        ok: false,
        at: new Date().toISOString(),
        error: message,
        checks: [],
      },
      { status: 503 }
    );
  }
}
