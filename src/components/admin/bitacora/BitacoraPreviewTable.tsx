"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BitacoraRow, BitacoraRowType } from "@/features/bitacora/types";
import { BitacoraRowBadge } from "./BitacoraRowBadge";

const COLUMNS: { key: keyof BitacoraRow; label: string }[] = [
  { key: "territorio", label: "Territorio" },
  { key: "anden", label: "Andén" },
  { key: "patente", label: "Camión" },
  { key: "conductor", label: "Chófer" },
  { key: "auxiliar", label: "Peoneta" },
  { key: "observacion", label: "Observ." },
  { key: "sector", label: "Sector" },
  { key: "recorrido", label: "Recorrido" },
  { key: "primerFolio", label: "1er Folio" },
  { key: "ultimoFolio", label: "Últ. Folio" },
  { key: "cantFact", label: "Fact." },
  { key: "puntos", label: "Ptos." },
  { key: "montoTotal", label: "Monto" },
  { key: "scheduledDate", label: "Fecha prog." },
];

const ROW_TYPES: BitacoraRowType[] = [
  "ruta",
  "entrega_pendiente",
  "manual",
  "totals",
  "unknown",
];

interface BitacoraPreviewTableProps {
  rows: BitacoraRow[];
  onChange: (rows: BitacoraRow[]) => void;
  onCreateRecord?: (row: BitacoraRow) => void;
  creatingRowId?: string | null;
  readOnly?: boolean;
}

export function BitacoraPreviewTable({
  rows,
  onChange,
  onCreateRecord,
  creatingRowId,
  readOnly = false,
}: BitacoraPreviewTableProps) {
  const updateRow = (idx: number, patch: Partial<BitacoraRow>) => {
    const next = [...rows];
    next[idx] = { ...next[idx]!, ...patch };
    onChange(next);
  };

  const updateCell = (
    idx: number,
    key: keyof BitacoraRow,
    value: string
  ) => {
    updateRow(idx, { [key]: value || undefined });
  };

  const rutas = rows.filter((r) => r.rowType === "ruta");
  const pendientes = rows.filter((r) => r.rowType === "entrega_pendiente");
  const manuales = rows.filter((r) => r.rowType === "manual");
  const otros = rows.filter(
    (r) =>
      !["ruta", "entrega_pendiente", "manual"].includes(r.rowType)
  );

  const sections = [
    { title: "Rutas del día", items: rutas },
    { title: "Entregas pendientes (otras fechas)", items: pendientes },
    { title: "Ingresos manuales", items: manuales },
    { title: "Otros", items: otros },
  ].filter((s) => s.items.length > 0);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin filas. Pega una tabla de Excel para comenzar.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.title} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground">
            {section.title}
          </h3>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-2 py-1.5 text-left text-xs font-medium">
                    Tipo
                  </th>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="px-2 py-1.5 text-left text-xs font-medium whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                  {onCreateRecord && (
                    <th className="px-2 py-1.5 text-xs font-medium">Acción</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {section.items.map((row) => {
                  const idx = rows.findIndex((r) => r.id === row.id);
                  return (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-2 py-1 align-top">
                        {readOnly ? (
                          <BitacoraRowBadge
                            rowType={row.rowType}
                            manualSubtype={row.manualSubtype}
                          />
                        ) : (
                          <Select
                            value={row.rowType}
                            onValueChange={(v) =>
                              updateRow(idx, {
                                rowType: v as BitacoraRowType,
                              })
                            }
                          >
                            <SelectTrigger className="h-7 w-[130px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROW_TYPES.map((t) => (
                                <SelectItem key={t} value={t}>
                                  {t}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </td>
                      {COLUMNS.map((col) => (
                        <td key={col.key} className="px-1 py-1">
                          {readOnly ? (
                            <span className="text-xs">
                              {(row[col.key] as string | undefined) ?? "—"}
                            </span>
                          ) : (
                            <Input
                              className="h-7 min-w-[72px] text-xs"
                              value={(row[col.key] as string | undefined) ?? ""}
                              onChange={(e) =>
                                updateCell(idx, col.key, e.target.value)
                              }
                            />
                          )}
                        </td>
                      ))}
                      {onCreateRecord && (
                        <td className="px-2 py-1 align-top">
                          {(row.rowType === "manual" ||
                            row.rowType === "ruta") && (
                            <button
                              type="button"
                              disabled={
                                Boolean(row.linkedRecordId) ||
                                creatingRowId === row.id
                              }
                              className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
                              onClick={() => onCreateRecord(row)}
                            >
                              {row.linkedRecordId
                                ? "Vinculado"
                                : creatingRowId === row.id
                                  ? "Creando…"
                                  : "Crear registro"}
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
