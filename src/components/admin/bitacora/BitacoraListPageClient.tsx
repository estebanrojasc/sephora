"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { BitacoraDayList } from "@/components/admin/bitacora/BitacoraDayList";
import { fetchBitacoraDates } from "@/features/bitacora/api";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function BitacoraListPageClient() {
  const router = useRouter();
  const [dates, setDates] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchBitacoraDates();
      setDates(next);
    } catch (e) {
      setDates([]);
      setError(e instanceof Error ? e.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    router.refresh();
  }, [load, router]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bitácora diaria"
        description="Carga matinal desde Excel: rutas, entregas pendientes e ingresos manuales."
        action={
          <Link
            href="/admin/bitacora/nueva"
            prefetch={false}
            className={cn(buttonVariants({ size: "sm" }))}
          >
            <Plus className="size-4" />
            Nueva bitácora
          </Link>
        }
      />
      {error ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-medium">No se pudo cargar la lista</p>
          <p className="mt-1 text-xs opacity-90">{error}</p>
          <button
            type="button"
            className="mt-2 text-xs underline"
            onClick={() => void load()}
          >
            Reintentar
          </button>
        </div>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando bitácoras…</p>
      ) : (
        <BitacoraDayList dates={dates ?? []} />
      )}
    </div>
  );
}
