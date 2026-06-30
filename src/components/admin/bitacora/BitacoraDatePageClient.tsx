"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import {
  BitacoraEditor,
  BitacoraVersionSelector,
} from "@/components/admin/bitacora/BitacoraEditor";
import { useBitacoraVersions } from "@/features/bitacora/queries";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BitacoraDatePageClient() {
  const router = useRouter();
  const params = useParams();
  const date = decodeURIComponent(String(params.date ?? ""));
  const {
    data: versions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useBitacoraVersions(date);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  useEffect(() => {
    router.refresh();
    void refetch();
  }, [router, refetch, date]);

  const active = versions.find((v) => v.isActive);
  const selected =
    versions.find((v) => v.id === (selectedId ?? active?.id)) ?? versions[0];

  const title = useMemo(() => {
    if (!selected) return `Bitácora ${date}`;
    return selected.title ?? `Bitácora ${date}`;
  }, [selected, date]);

  if (isError) {
    return (
      <div className="space-y-4">
        <PageHeader title={`Bitácora ${date}`} />
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-medium">No se pudo cargar la bitácora</p>
          <p className="mt-1 text-xs opacity-90">
            {error instanceof Error ? error.message : "Error desconocido"}
          </p>
          <button
            type="button"
            className="mt-2 text-xs underline"
            onClick={() => void refetch()}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }

  if (!selected) {
    return (
      <div className="space-y-4">
        <PageHeader title={`Bitácora ${date}`} />
        <p className="text-sm text-muted-foreground">
          No hay bitácora para esta fecha.{" "}
          <Link href="/admin/bitacora/nueva" className="text-indigo-600 underline">
            Crear una
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={`Fecha ${date} · versión ${selected.version}${selected.isActive ? " (activa)" : ""}`}
        action={
          <Link
            href="/admin/bitacora/nueva"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Nueva versión
          </Link>
        }
      />
      {versions.length > 1 && (
        <BitacoraVersionSelector
          versions={versions}
          selectedId={selected.id}
          onSelect={setSelectedId}
        />
      )}
      <BitacoraEditor key={selected.id} initial={selected} readOnly />
    </div>
  );
}
