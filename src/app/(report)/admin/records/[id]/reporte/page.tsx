"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ReporteEjecutivo } from "@/features/pdf/ReporteEjecutivo";
import { useRecord } from "@/features/records/queries";

export default function ReportePage() {
  const params = useParams();
  const id = params.id as string;
  const { data: record, isLoading, error } = useRecord(id);

  if (isLoading || !record) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
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
