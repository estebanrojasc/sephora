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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Record } from "@/features/records/types";
import { getRecordConductorLabel } from "@/features/records/display";
import { formatExtractedDateChilean } from "@/lib/date-utils";
import { toast } from "sonner";

interface BulkExcelExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  records: Record[];
}

function recordDayKey(record: Record, mode: "created" | "fecha"): string {
  if (mode === "fecha") {
    const raw = record.extraction?.fecha?.valor?.trim();
    if (raw) {
      try {
        return formatExtractedDateChilean(raw);
      } catch {
        /* fallback */
      }
    }
  }
  return new Date(record.createdAt).toLocaleDateString("en-CA", {
    timeZone: "America/Santiago",
  });
}

export function BulkExcelExportDialog({
  open,
  onOpenChange,
  records,
}: BulkExcelExportDialogProps) {
  const [dateFilter, setDateFilter] = useState("");
  const [dateMode, setDateMode] = useState<"created" | "fecha">("created");
  const [loading, setLoading] = useState(false);
  const [orderedRecords, setOrderedRecords] = useState<Record[]>([]);

  const filtered = useMemo(() => {
    if (!dateFilter) return records;
    return records.filter(
      (r) => recordDayKey(r, dateMode) === dateFilter
    );
  }, [records, dateFilter, dateMode]);

  useEffect(() => {
    setOrderedRecords(filtered);
  }, [filtered]);

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
      toast.error("No hay registros para exportar con el filtro actual");
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Excel unificado</DialogTitle>
          <DialogDescription>
            Genera un archivo con una hoja RUTA por registro (misma plantilla
            que el Excel individual). Ordena las filas antes de exportar. Máximo
            50 registros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-date-filter">Filtrar por día (opcional)</Label>
            <Input
              id="bulk-date-filter"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>

          <div className="flex gap-2 text-sm">
            <Button
              type="button"
              size="sm"
              variant={dateMode === "created" ? "default" : "outline"}
              onClick={() => setDateMode("created")}
            >
              Fecha de carga
            </Button>
            <Button
              type="button"
              size="sm"
              variant={dateMode === "fecha" ? "default" : "outline"}
              onClick={() => setDateMode("fecha")}
            >
              Fecha recorrido
            </Button>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-md border p-2 text-sm">
            {orderedRecords.length === 0 ? (
              <p className="text-muted-foreground">Sin registros en el filtro.</p>
            ) : (
              <ul className="space-y-1">
                {orderedRecords.map((r, index) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-2 rounded-sm px-1 py-0.5 hover:bg-muted/50"
                  >
                    <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {r.extraction?.n_recorrido?.valor || r.id.slice(0, 8)}
                      {" · "}
                      {getRecordConductorLabel(r)}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {recordDayKey(r, dateMode)}
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
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {orderedRecords.length} registro(s) · el orden define el orden de las
            hojas RUTA en el archivo
            {orderedRecords.length > 50 && " — reduce la selección (máx. 50)"}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
