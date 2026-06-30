"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { BitacoraDayList } from "@/components/admin/bitacora/BitacoraEditor";
import { useBitacoraDates } from "@/features/bitacora/queries";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BitacoraListPageClient() {
  const router = useRouter();
  const { data: dates, isLoading, isError, error, refetch, isFetching } =
    useBitacoraDates();

  useEffect(() => {
    router.refresh();
    void refetch();
  }, [router, refetch]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bitácora diaria"
        description="Carga matinal desde Excel: rutas, entregas pendientes e ingresos manuales."
        action={
          <Link
            href="/admin/bitacora/nueva"
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Plus className="size-4" />
            Nueva bitácora
          </Link>
        }
      />
      {isError ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-medium">No se pudo cargar la lista</p>
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
      ) : null}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando bitácoras…</p>
      ) : (
        <>
          {isFetching && (dates?.length ?? 0) > 0 ? (
            <p className="text-xs text-muted-foreground">Actualizando…</p>
          ) : null}
          <BitacoraDayList dates={dates ?? []} />
        </>
      )}
    </div>
  );
}
