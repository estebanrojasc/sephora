import { jsonNoStore } from "@/lib/api-response";
import { runSystemHealthCheck } from "@/lib/health-check";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

export async function GET() {
  try {
    const report = await runSystemHealthCheck();
    const ping = report.checks.find((c) => c.name === "mongo_ping");
    if (!report.ok || !ping?.ok) {
      return jsonNoStore(report, { status: 503 });
    }
    return jsonNoStore({
      ok: true,
      pingMs: ping.ms,
      database: report.env.mongoDbName,
      counts: report.checks.find((c) => c.name === "mongo_counts")?.detail,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonNoStore({ ok: false, message, detail: message }, { status: 503 });
  }
}
