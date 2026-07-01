import "server-only";
import { COLLECTIONS, getDb, pingMongo } from "@/lib/mongo";

export interface HealthCheckItem {
  name: string;
  ok: boolean;
  ms?: number;
  detail?: string;
  error?: string;
}

export interface SystemHealthReport {
  ok: boolean;
  at: string;
  host: string;
  env: {
    nodeEnv: string;
    vercel: boolean;
    railway: boolean;
    hasMongoUri: boolean;
    hasAuthSecret: boolean;
    mongoDbName: string;
  };
  checks: HealthCheckItem[];
}

function safeUriDbName(): string {
  const uri = process.env.MONGODB_URI ?? "";
  try {
    const pathname = new URL(uri).pathname.replace(/^\//, "");
    return pathname || "proyectoisaqwen";
  } catch {
    return "proyectoisaqwen";
  }
}

export async function runSystemHealthCheck(): Promise<SystemHealthReport> {
  const checks: HealthCheckItem[] = [];
  const at = new Date().toISOString();
  const env = {
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    vercel: process.env.VERCEL === "1",
    railway: Boolean(process.env.RAILWAY_ENVIRONMENT),
    hasMongoUri: Boolean(process.env.MONGODB_URI?.trim()),
    hasAuthSecret: Boolean(process.env.AUTH_SECRET?.trim()),
    mongoDbName: safeUriDbName(),
  };

  if (!env.hasMongoUri) {
    checks.push({
      name: "MONGODB_URI",
      ok: false,
      error: "Variable de entorno MONGODB_URI no definida.",
    });
    return { ok: false, at, host: "server", env, checks };
  }

  if (!env.hasAuthSecret) {
    checks.push({
      name: "AUTH_SECRET",
      ok: false,
      error: "Variable AUTH_SECRET no definida (login admin fallará).",
    });
  } else {
    checks.push({ name: "AUTH_SECRET", ok: true, detail: "configurada" });
  }

  try {
    const ping = await pingMongo();
    const slow = ping.ms > 3_000;
    checks.push({
      name: "mongo_ping",
      ok: true,
      ms: ping.ms,
      detail: slow
        ? `pong en ${ping.ms}ms (lento: Railway↔Atlas; la lista ya no carga imágenes)`
        : `pong en ${ping.ms}ms`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    checks.push({
      name: "mongo_ping",
      ok: false,
      error: message,
    });
    return { ok: false, at, host: "server", env, checks };
  }

  try {
    const db = await getDb();
    const started = Date.now();
    const counts = await Promise.all([
      db.collection(COLLECTIONS.records).countDocuments(),
      db.collection(COLLECTIONS.bitacoras).countDocuments(),
      db.collection(COLLECTIONS.catalogs).countDocuments(),
      db.collection(COLLECTIONS.users).countDocuments(),
    ]);
    checks.push({
      name: "mongo_counts",
      ok: true,
      ms: Date.now() - started,
      detail: `records=${counts[0]}, bitacoras=${counts[1]}, catalogs=${counts[2]}, users=${counts[3]}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    checks.push({
      name: "mongo_counts",
      ok: false,
      error: message,
    });
  }

  const ok = checks.every((c) => c.ok);
  return { ok, at, host: "server", env, checks };
}
