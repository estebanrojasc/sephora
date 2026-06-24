"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, Loader2 } from "lucide-react";
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

  const filtered = useMemo(() => {
    if (!dateFilter) return records;
    return records.filter(
      (r) => recordDayKey(r, dateMode) === dateFilter
    );
  }, [records, dateFilter, dateMode]);

  async function handleExport() {
    if (filtered.length === 0) {
      toast.error("No hay registros para exportar con el filtro actual");
      return;
    }
    if (filtered.length > 50) {
      toast.error("Máximo 50 registros por exportación");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/records/excel/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordIds: filtered.map((r) => r.id) }),
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
      toast.success(`Excel consolidado (${filtered.length} registros)`);
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
            Genera un archivo con hoja resumen horizontal y una hoja RUTA por
            registro. Máximo 50 registros.
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

          <div className="max-h-48 overflow-y-auto rounded-md border p-2 text-sm">
            {filtered.length === 0 ? (
              <p className="text-muted-foreground">Sin registros en el filtro.</p>
            ) : (
              <ul className="space-y-1">
                {filtered.map((r) => (
                  <li key={r.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {r.extraction?.n_recorrido?.valor || r.id.slice(0, 8)}
                      {" · "}
                      {getRecordConductorLabel(r)}
                    </span>
                    <span className="shrink-0 text-muted-foreground">
                      {recordDayKey(r, dateMode)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {filtered.length} registro(s) seleccionado(s)
            {filtered.length > 50 && " — reduce la selección (máx. 50)"}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleExport}
            disabled={loading || filtered.length === 0 || filtered.length > 50}
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
