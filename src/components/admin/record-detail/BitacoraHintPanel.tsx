"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { Extraction, Record } from "@/features/records/types";
import { useActiveBitacora } from "@/features/bitacora/queries";
import {
  getRecordDayForBitacora,
  matchRecordToBitacora,
} from "@/features/bitacora/match";
import { cn } from "@/lib/utils";

const SCALAR_FIELDS = [
  { key: "patente", label: "Patente" },
  { key: "conductor", label: "Conductor" },
  { key: "auxiliar", label: "Auxiliar" },
  { key: "n_recorrido", label: "Recorrido" },
  { key: "cant_fact", label: "Cant. fact." },
  { key: "valor_total", label: "Valor total" },
] as const;

interface BitacoraHintPanelProps {
  record: Record;
  extraction: Extraction | null;
  onApplyField: (field: keyof Extraction, value: string) => void;
}

export function BitacoraHintPanel({
  record,
  extraction,
  onApplyField,
}: BitacoraHintPanelProps) {
  const day = getRecordDayForBitacora(record);
  const { data: bitacora } = useActiveBitacora(day);

  const meta = extraction?._meta?.bitacora;
  const match =
    bitacora && extraction
      ? matchRecordToBitacora(record, bitacora)
      : null;

  const suggested = meta?.suggested ?? match?.suggested;
  const score = meta?.matchScore ?? match?.matchScore ?? 0;

  if (!bitacora) {
    return (
      <Alert className="border-dashed">
        <AlertDescription className="flex items-center justify-between gap-2 text-xs">
          <span>No hay bitácora activa para {day}.</span>
          <Link
            href="/admin/bitacora/nueva"
            className="inline-flex items-center gap-1 text-indigo-600 hover:underline"
          >
            <BookOpen className="size-3.5" />
            Cargar
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  if (!suggested || score < 40) {
    return (
      <Alert className="border-dashed">
        <AlertDescription className="text-xs">
          Bitácora del {day} cargada, pero sin coincidencia clara con este
          registro (score {score}).{" "}
          <Link
            href={`/admin/bitacora/${day}`}
            className="text-indigo-600 hover:underline"
          >
            Ver bitácora
          </Link>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Bitácora del día (pista)
        </p>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-medium",
            score >= 60
              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
              : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
          )}
        >
          Match {score}%
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Referencia matinal; prioriza la imagen si hay diferencias.
      </p>
      <div className="space-y-1">
        {SCALAR_FIELDS.map(({ key, label }) => {
          const sug = suggested[key];
          if (!sug) return null;
          const field = extraction?.[key];
          const current =
            field &&
            typeof field === "object" &&
            "valor" in field
              ? (field as { valor: string }).valor
              : "";
          const differs =
            current.trim().toLowerCase() !== sug.trim().toLowerCase();
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0">
                <span className="text-muted-foreground">{label}: </span>
                <span
                  className={cn(
                    differs && "font-medium text-amber-700 dark:text-amber-300"
                  )}
                >
                  {sug}
                </span>
                {differs && current && (
                  <span className="ml-1 text-muted-foreground">
                    (actual: {current})
                  </span>
                )}
              </div>
              {differs && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 shrink-0 px-2 text-[10px]"
                  onClick={() => onApplyField(key, sug)}
                >
                  Aplicar
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <Link
        href={`/admin/bitacora/${day}`}
        className="inline-block text-[10px] text-indigo-600 hover:underline"
      >
        Ver bitácora v{meta?.version ?? bitacora.version}
      </Link>
    </div>
  );
}
