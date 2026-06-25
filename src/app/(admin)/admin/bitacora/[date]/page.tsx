"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/common/PageHeader";
import {
  BitacoraEditor,
  BitacoraVersionSelector,
} from "@/components/admin/bitacora/BitacoraEditor";
import { useBitacoraVersions } from "@/features/bitacora/queries";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function BitacoraDatePage() {
  const params = useParams();
  const date = decodeURIComponent(String(params.date ?? ""));
  const { data: versions = [], isLoading } = useBitacoraVersions(date);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const active = versions.find((v) => v.isActive);
  const selected =
    versions.find((v) => v.id === (selectedId ?? active?.id)) ?? versions[0];

  const title = useMemo(() => {
    if (!selected) return `Bitácora ${date}`;
    return selected.title ?? `Bitácora ${date}`;
  }, [selected, date]);

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
