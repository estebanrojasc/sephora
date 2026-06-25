"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { BitacoraDayList } from "@/components/admin/bitacora/BitacoraEditor";
import { useBitacoraDates } from "@/features/bitacora/queries";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function BitacoraListPage() {
  const { data: dates = [], isLoading } = useBitacoraDates();

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
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Cargando…</p>
      ) : (
        <BitacoraDayList dates={dates} />
      )}
    </div>
  );
}
