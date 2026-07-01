"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Record } from "@/features/records/types";
import { getRecordConductorLabel } from "@/features/records/display";
import { duplicateRecorridoKeys } from "@/features/records/filter-by-day";
import type { Bitacora } from "@/features/bitacora/types";
import { sortRecordsByBitacora } from "@/features/bitacora/sort-records-by-bitacora";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface BulkExcelExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: Record[];
  activeBitacora?: Bitacora | null;
}

function recorridoKey(record: Record): string {
  return record.extraction?.n_recorrido?.valor?.trim().toLowerCase() ?? "";
}

export function BulkExcelExportDialog({
  open,
  onOpenChange,
  records,
  activeBitacora = null,
}: BulkExcelExportDialogProps) {
  const [loading, setLoading] = useState(false);
  const [orderedRecords, setOrderedRecords] = useState<Record[]>([]);

  const duplicateRecorridos = useMemo(
    () => duplicateRecorridoKeys(records),
    [records]
  );

  useEffect(() => {
    if (open) {
      setOrderedRecords(sortRecordsByBitacora(records, activeBitacora));
    }
  }, [open, records, activeBitacora]);

  function requestClose() {
    if (loading) return;
    const confirmed = window.confirm(
      "¿Cerrar el diálogo? Si reordenaste filas y no exportaste, perderás ese orden."
    );
    if (confirmed) onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      onOpenChange(true);
      return;
    }
    requestClose();
  }

  function moveRecord(index: number, direction: -1 | 1) {
    setOrderedRecords((prev) => {
      const target = index + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }

  async function handleExport() {
    if (orderedRecords.length === 0) {
      toast.error("No hay registros para exportar");
      return;
    }
    if (orderedRecords.length > 50) {
      toast.error("Máximo 50 registros por exportación");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/records/excel/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordIds: orderedRecords.map((r) => r.id),
        }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? "Error al generar Excel");
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? "consolidado.xlsx";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Excel consolidado (${orderedRecords.length} registros)`);
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al exportar Excel"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Excel unificado</DialogTitle>
          <DialogDescription>
            Exporta los registros visibles en la tabla (día y tab actuales) en
            una hoja Resumen consolidada. Ordena las filas antes de descargar.
            Máximo 50 registros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="max-h-56 overflow-y-auto rounded-md border p-2 text-sm">
            {orderedRecords.length === 0 ? (
              <p className="text-muted-foreground">
                No hay registros en la tabla para exportar.
              </p>
            ) : (
              <ul className="space-y-1">
                {orderedRecords.map((r, index) => {
                  const rec = r.extraction?.n_recorrido?.valor || r.id.slice(0, 8);
                  const isDupe = duplicateRecorridos.has(recorridoKey(r));
                  return (
                    <li
                      key={r.id}
                      className="flex items-center gap-2 rounded-sm px-1 py-0.5 hover:bg-muted/50"
                    >
                      <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
                        {index + 1}
                      </span>
                      <span
                        className={cn(
                          "min-w-0 flex-1 truncate rounded-full px-2 py-0.5",
                          isDupe && "animate-recorrido-blink ring-2 ring-red-500"
                        )}
                        title={isDupe ? "Recorrido duplicado" : undefined}
                      >
                        {rec}
                        {" · "}
                        {getRecordConductorLabel(r)}
                      </span>
                      <div className="flex shrink-0 flex-col">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          disabled={index === 0}
                          onClick={() => moveRecord(index, -1)}
                          aria-label="Subir"
                        >
                          <ChevronUp className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          disabled={index === orderedRecords.length - 1}
                          onClick={() => moveRecord(index, 1)}
                          aria-label="Bajar"
                        >
                          <ChevronDown className="size-3.5" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {orderedRecords.length} registro(s) · el orden define las columnas
            del resumen
            {orderedRecords.length > 50 && " — reduce la selección (máx. 50)"}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={requestClose} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={
              loading || orderedRecords.length === 0 || orderedRecords.length > 50
            }
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="size-4" />
            )}
            Descargar Excel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
