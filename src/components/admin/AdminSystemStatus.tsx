"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { fetchJsonNoStore, ApiFetchError } from "@/lib/fetch-client";
import { Button } from "@/components/ui/button";

interface HealthCheckItem {
  name: string;
  ok: boolean;
  ms?: number;
  detail?: string;
  error?: string;
}

interface SystemHealthReport {
  ok: boolean;
  at: string;
  checks: HealthCheckItem[];
  env?: {
    hasMongoUri?: boolean;
    hasAuthSecret?: boolean;
    railway?: boolean;
    vercel?: boolean;
    mongoDbName?: string;
  };
  error?: string;
}

async function fetchHealthReport(): Promise<{
  report: SystemHealthReport | null;
  fetchError: string | null;
}> {
  try {
    const data = await fetchJsonNoStore<SystemHealthReport>(
      "/api/health?light=1"
    );
    return { report: data, fetchError: null };
  } catch (e) {
    if (e instanceof ApiFetchError) {
      const body = e.body as SystemHealthReport | null;
      if (body && typeof body === "object" && "checks" in body) {
        return { report: body, fetchError: e.message };
      }
      return { report: null, fetchError: e.message };
    }
    return {
      report: null,
      fetchError: e instanceof Error ? e.message : "Error desconocido",
    };
  }
}

export function AdminSystemStatus() {
  const [report, setReport] = useState<SystemHealthReport | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const applyResult = useCallback(
    (result: { report: SystemHealthReport | null; fetchError: string | null }) => {
      setReport(result.report);
      setFetchError(result.fetchError);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    void fetchHealthReport().then((result) => {
      if (!cancelled) applyResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [applyResult]);

  const handleRetry = useCallback(() => {
    setLoading(true);
    void fetchHealthReport().then(applyResult);
  }, [applyResult]);

  if (loading) return null;
  if (report?.ok) return null;

  const failedChecks = report?.checks.filter((c) => !c.ok) ?? [];

  return (
    <div
      role="alert"
      className="mb-4 rounded-lg border border-red-400 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-700 dark:bg-red-950/50 dark:text-red-100"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <div className="min-w-0 space-y-2">
            <p className="font-semibold">Problema de conexión con el servidor</p>
            {fetchError ? (
              <p className="text-xs opacity-90">{fetchError}</p>
            ) : null}
            {report?.error ? (
              <p className="text-xs opacity-90">{report.error}</p>
            ) : null}
            {failedChecks.length > 0 ? (
              <ul className="list-inside list-disc space-y-1 text-xs">
                {failedChecks.map((c) => (
                  <li key={c.name}>
                    <span className="font-medium">{c.name}</span>
                    {c.error ? `: ${c.error}` : ""}
                    {c.detail ? ` (${c.detail})` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
            {report?.env ? (
              <p className="text-[11px] opacity-75">
                Mongo URI: {report.env.hasMongoUri ? "sí" : "NO"} · Auth secret:{" "}
                {report.env.hasAuthSecret ? "sí" : "NO"} · DB:{" "}
                {report.env.mongoDbName ?? "?"}
              </p>
            ) : null}
            <p className="text-[11px] opacity-75">
              Diagnóstico completo:{" "}
              <Link
                href="/api/health"
                target="_blank"
                className="underline"
                prefetch={false}
              >
                /api/health
              </Link>
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-red-300 bg-white/80 dark:border-red-700 dark:bg-red-950"
          onClick={handleRetry}
        >
          <RefreshCw className="size-3.5" />
          Reintentar
        </Button>
      </div>
    </div>
  );
}
