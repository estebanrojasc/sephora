"use client";

import Link from "next/link";
import { useMemo } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Extraction, Record } from "@/features/records/types";
import { useActiveBitacora } from "@/features/bitacora/queries";
import { useRecords } from "@/features/records/queries";
import {
  formatBitacoraRowLabel,
  getRecordDayForBitacora,
  listAvailableBitacoraRows,
  matchRecordToBitacora,
  scoreBitacoraRow,
} from "@/features/bitacora/match";
import { rowToExcelFields, type BitacoraExcelFields } from "@/features/bitacora/meta";
import { blockedBitacoraRowIdsForRecord } from "@/features/bitacora/row-links";
import { cn } from "@/lib/utils";

const DISPLAY_FIELDS: {
  key: keyof BitacoraExcelFields;
  label: string;
  extractionKey?: keyof Extraction;
}[] = [
  { key: "patente", label: "Patente", extractionKey: "patente" },
  { key: "conductor", label: "Conductor", extractionKey: "conductor" },
  { key: "auxiliar", label: "Auxiliar / peoneta", extractionKey: "auxiliar" },
  { key: "observaciones", label: "Observaciones", extractionKey: "observaciones" },
  { key: "sector", label: "Sector entrega" },
  { key: "recorrido", label: "Recorrido", extractionKey: "n_recorrido" },
  { key: "n_factura", label: "N° facturas", extractionKey: "cant_fact" },
  { key: "total_factura", label: "Total factura", extractionKey: "valor_total" },
];

function readExtractionValue(
  extraction: Extraction | null,
  extractionKey?: keyof Extraction
): string {
  if (!extraction || !extractionKey) return "";
  const field = extraction[extractionKey];
  if (field && typeof field === "object" && "valor" in field) {
    return (field as { valor: string }).valor.trim();
  }
  return "";
}

interface BitacoraHintPanelProps {
  record: Record;
  extraction: Extraction | null;
  selectedRowId?: string | null;
  /** true cuando el revisor cambió la fila y aún no aplica valores. */
  rowSelectionDirty?: boolean;
  onSelectRow?: (rowId: string) => void;
  onApplyField: (
    field: keyof BitacoraExcelFields,
    value: string,
    rowId: string
  ) => void;
  onApplyAll?: (rowId: string) => void;
}

export function BitacoraHintPanel({
  record,
  extraction,
  selectedRowId,
  rowSelectionDirty = false,
  onSelectRow,
  onApplyField,
  onApplyAll,
}: BitacoraHintPanelProps) {
  const day = getRecordDayForBitacora(record);
  const { data: bitacora } = useActiveBitacora(day);
  const { data: allRecords } = useRecords();

  const meta = extraction?._meta?.bitacora;
  const autoMatch =
    bitacora && extraction
      ? matchRecordToBitacora(record, bitacora)
      : null;

  const currentRowId = selectedRowId ?? meta?.rowId ?? null;

  const occupiedRowIds = useMemo(() => {
    if (!bitacora) return new Set<string>();
    return blockedBitacoraRowIdsForRecord(
      bitacora,
      allRecords ?? [],
      record.id
    );
  }, [allRecords, bitacora, record.id]);

  const assignable = useMemo(
    () =>
      bitacora
        ? listAvailableBitacoraRows(bitacora, {
            currentRecordId: record.id,
            currentRowId,
            blockedRowIds: occupiedRowIds,
          })
        : [],
    [bitacora, record.id, currentRowId, occupiedRowIds]
  );

  const activeRowId =
    currentRowId ?? autoMatch?.rowId ?? assignable[0]?.id ?? "";
  const activeRow =
    assignable.find((r) => r.id === activeRowId) ??
    bitacora?.rows.find((r) => r.id === activeRowId);

  const score =
    meta?.matchScore ??
    (activeRow && extraction
      ? scoreBitacoraRow({ ...record, extraction }, activeRow)
      : autoMatch?.matchScore ?? 0);

  const suggestedFlat: BitacoraExcelFields | null = activeRow
    ? rowToExcelFields(activeRow)
    : null;

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

  if (assignable.length === 0) {
    return (
      <Alert className="border-dashed">
        <AlertDescription className="text-xs">
          {occupiedRowIds.size > 0
            ? "Todas las filas de ruta/manual ya están vinculadas a otros registros."
            : `Bitácora del ${day} sin filas de ruta o manual.`}{" "}
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

  const recognized = meta?.rowId === activeRowId ? meta?.recognized : undefined;
  const excelSaved = meta?.rowId === activeRowId ? meta?.excel : undefined;

  return (
    <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase text-muted-foreground">
          Bitácora del día
        </p>
        <div className="flex items-center gap-2">
          {onApplyAll && suggestedFlat && activeRowId && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-6 px-2 text-[10px]"
              onClick={() => onApplyAll(activeRowId)}
            >
              Aplicar todo
            </Button>
          )}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[10px] font-medium",
              score >= 60
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                : score >= 40
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                  : "bg-muted text-muted-foreground"
            )}
          >
            Match {score}%
          </span>
        </div>
      </div>

      {rowSelectionDirty && (
        <p className="text-[10px] font-medium text-indigo-700 dark:text-indigo-300">
          Cambiaste la fila — usa «Aplicar todo» para actualizar los valores del
          formulario.
        </p>
      )}

      <div className="space-y-1">
        <p className="text-[10px] text-muted-foreground">
          Fila de bitácora (elige si el match automático no es correcto):
        </p>
        <Select
          value={activeRowId}
          onValueChange={(v) => {
            if (v) onSelectRow?.(v);
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Seleccionar fila…">
              {activeRow ? formatBitacoraRowLabel(activeRow) : undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {assignable.map((row) => (
              <SelectItem key={row.id} value={row.id} className="text-xs">
                {formatBitacoraRowLabel(row)}
                {autoMatch?.rowId === row.id ? " (auto)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {score < 40 && (
        <p className="text-[10px] text-amber-700 dark:text-amber-300">
          Coincidencia baja con OCR — selecciona manualmente la fila correcta.
        </p>
      )}

      <p className="text-[10px] text-muted-foreground">
        Al aplicar conductor, el nombre en la cabecera se actualiza al instante.
        Guarda para persistir en Mongo (incluye <code className="text-[9px]">driverName</code>).
      </p>

      {suggestedFlat && (
        <div className="space-y-1">
          {DISPLAY_FIELDS.map(({ key, label, extractionKey }) => {
            const sug = suggestedFlat[key];
            if (!sug) return null;
            const current = extractionKey
              ? readExtractionValue(extraction, extractionKey)
              : (excelSaved?.[key] ?? "");
            const rec = recognized?.[key];
            const differs =
              current.trim().toLowerCase() !== sug.trim().toLowerCase();
            const applied = meta?.applied?.[key];
            const showApply = differs || (rowSelectionDirty && Boolean(sug));
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <div className="min-w-0">
                  <span className="text-muted-foreground">{label}: </span>
                  <span
                    className={cn(
                      differs && "font-medium text-amber-700 dark:text-amber-300",
                      applied && "text-green-700 dark:text-green-300"
                    )}
                  >
                    {sug}
                  </span>
                  {rec && rec !== sug && (
                    <span className="ml-1 text-[10px] text-muted-foreground">
                      (OCR: {rec})
                    </span>
                  )}
                  {differs && current && (
                    <span className="ml-1 text-muted-foreground">
                      (actual: {current})
                    </span>
                  )}
                </div>
                {showApply && activeRowId && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 shrink-0 px-2 text-[10px]"
                    onClick={() => onApplyField(key, sug, activeRowId)}
                  >
                    Aplicar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {excelSaved && (
        <p className="text-[10px] text-muted-foreground">
          Excel: datos en{" "}
          <code className="text-[9px]">_meta.bitacora.excel</code>
        </p>
      )}
      <Link
        href={`/admin/bitacora/${day}`}
        className="inline-block text-[10px] text-indigo-600 hover:underline"
      >
        Ver bitácora v{meta?.version ?? bitacora.version}
      </Link>
    </div>
  );
}
