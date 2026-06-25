"use client";

import { PageHeader } from "@/components/common/PageHeader";
import { BitacoraEditor } from "@/components/admin/bitacora/BitacoraEditor";

export default function NuevaBitacoraPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva bitácora"
        description="Pega la tabla de Excel, revisa las filas y guarda la versión del día."
      />
      <BitacoraEditor />
    </div>
  );
}
