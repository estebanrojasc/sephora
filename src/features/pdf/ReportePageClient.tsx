"use client";

import Link from "next/link";
import { ReporteEjecutivo } from "@/features/pdf/ReporteEjecutivo";
import { useRecord } from "@/features/records/queries";

interface ReportePageClientProps {
  id: string;
}

export function ReportePageClient({ id }: ReportePageClientProps) {
  const { data: record, isLoading, error } = useRecord(id);

  if (isLoading || !record) {
    return (
      <div className="flex h-dvh items-center justify-center text-sm text-muted-foreground">
        Cargando reporte…
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <h1 className="mb-2 text-lg font-semibold">Registro no disponible</h1>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Error desconocido"}.
        </p>
        <Link
          href="/admin"
          className="mt-4 inline-block text-sm text-indigo-600 underline"
        >
          Volver al panel
        </Link>
      </div>
    );
  }

  return <ReporteEjecutivo record={record} />;
}
