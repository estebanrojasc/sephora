"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import { BitacoraEditor } from "@/components/admin/bitacora/BitacoraEditor";

function NuevaBitacoraContent() {
  const searchParams = useSearchParams();
  const dateParam = searchParams.get("date") ?? undefined;
  const defaultDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title={defaultDate ? "Nueva versión" : "Nueva bitácora"}
        description={
          defaultDate
            ? `Re-pega el Excel del ${defaultDate}. Los vínculos a registros existentes se reenganchan por recorrido.`
            : "Pega la tabla de Excel, revisa las filas y guarda la versión del día."
        }
      />
      <BitacoraEditor defaultDate={defaultDate} />
    </div>
  );
}

export default function NuevaBitacoraPage() {
  return (
    <Suspense
      fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}
    >
      <NuevaBitacoraContent />
    </Suspense>
  );
}
