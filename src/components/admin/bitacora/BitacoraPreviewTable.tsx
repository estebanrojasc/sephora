"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { newId } from "@/lib/id";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BitacoraRow, BitacoraRowType } from "@/features/bitacora/types";
import { bitacoraRecorridoCanonical } from "@/features/bitacora/meta";
import {
  canCreateRecordForBitacoraRow,
  defaultAllowsMultipleReviews,
  rowAllowsMultipleReviews,
  type BitacoraRowRecordLink,
} from "@/features/bitacora/row-links";
import { StatusBadge } from "@/components/common/StatusBadge";
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
  rowRecordLinks?: Map<string, BitacoraRowRecordLink[]>;
  onToggleMultipleReviews?: (
    rowId: string,
    allowsMultipleReviews: boolean
  ) => void;
}

export function BitacoraPreviewTable({
  rows,
  onChange,
  onCreateRecord,
  creatingRowId,
  readOnly = false,
  rowRecordLinks,
  onToggleMultipleReviews,
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

  const addRow = (rowType: BitacoraRowType) => {
    onChange([
      ...rows,
      {
        id: newId(),
        rowType,
        manualSubtype: rowType === "manual" ? "ingreso_manual" : undefined,
        allowsMultipleReviews: defaultAllowsMultipleReviews({
          id: "",
          rowType,
        }),
      },
    ]);
  };

  const showLinksColumn = Boolean(rowRecordLinks);
  const showActionsColumn = Boolean(onCreateRecord);
  const showRowSettingsColumn =
    showActionsColumn || Boolean(onToggleMultipleReviews) || !readOnly;

  const sections = [
    { title: "Rutas del día", items: rutas },
    { title: "Entregas pendientes (otras fechas)", items: pendientes },
    { title: "Ingresos manuales", items: manuales },
    { title: "No reconocidas / revisar", items: otros },
  ].filter((s) => s.items.length > 0);

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Sin filas. Pega una tabla de Excel o agrega filas manualmente.
        </p>
        {!readOnly && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => addRow("manual")}
            >
              <Plus className="size-3.5" />
              Agregar ingreso manual
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => addRow("ruta")}
            >
              <Plus className="size-3.5" />
              Agregar ruta
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => addRow("entrega_pendiente")}
            >
              <Plus className="size-3.5" />
              Agregar entrega pendiente
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => addRow("manual")}
          >
            <Plus className="size-3.5" />
            Agregar ingreso manual
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => addRow("ruta")}
          >
            <Plus className="size-3.5" />
            Agregar ruta
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => addRow("entrega_pendiente")}
          >
            <Plus className="size-3.5" />
            Agregar entrega pendiente
          </Button>
          {otros.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => addRow("unknown")}
            >
              <Plus className="size-3.5" />
              Agregar fila sin clasificar
            </Button>
          )}
        </div>
      )}
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
                  {showLinksColumn && (
                    <th className="px-2 py-1.5 text-left text-xs font-medium">
                      Revisiones
                    </th>
                  )}
                  {(showRowSettingsColumn || onToggleMultipleReviews) && (
                    <th className="px-2 py-1.5 text-xs font-medium">Acción</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {section.items.map((row) => {
                  const idx = rows.findIndex((r) => r.id === row.id);
                  const links = rowRecordLinks?.get(row.id) ?? [];
                  const canCreate =
                    onCreateRecord &&
                    canCreateRecordForBitacoraRow(row, links);
                  const allowsMultiple = rowAllowsMultipleReviews(row);
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
                              {col.key === "recorrido"
                                ? (bitacoraRecorridoCanonical(row) ?? "—")
                                : ((row[col.key] as string | undefined) ?? "—")}
                            </span>
                          ) : (
                            <Input
                              className="h-7 min-w-[72px] text-xs"
                              value={
                                col.key === "recorrido"
                                  ? (row.recorrido ??
                                    row.recorridoSuffix ??
                                    "")
                                  : ((row[col.key] as string | undefined) ??
                                    "")
                              }
                              onChange={(e) =>
                                updateCell(
                                  idx,
                                  col.key === "recorrido"
                                    ? "recorrido"
                                    : col.key,
                                  e.target.value
                                )
                              }
                            />
                          )}
                        </td>
                      ))}
                      {showLinksColumn && (
                        <td className="px-2 py-1 align-top">
                          {links.length === 0 ? (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          ) : (
                            <ul className="space-y-1">
                              {links.map((link) => (
                                <li key={link.recordId}>
                                  <Link
                                    href={`/admin/records/${link.recordId}`}
                                    className="inline-flex flex-wrap items-center gap-1 text-xs text-indigo-600 hover:underline"
                                  >
                                    <span>{link.label}</span>
                                    <StatusBadge status={link.status} />
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      )}
                      {(showRowSettingsColumn || onToggleMultipleReviews) && (
                        <td className="px-2 py-1 align-top space-y-2">
                          {(row.rowType === "manual" ||
                            row.rowType === "ruta" ||
                            row.rowType === "entrega_pendiente") && (
                            <>
                              <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                <input
                                  type="checkbox"
                                  className="size-3.5 rounded border"
                                  checked={allowsMultiple}
                                  disabled={
                                    readOnly && !onToggleMultipleReviews
                                  }
                                  onChange={(e) => {
                                    const next = e.target.checked;
                                    if (onToggleMultipleReviews) {
                                      onToggleMultipleReviews(row.id, next);
                                      return;
                                    }
                                    updateRow(idx, {
                                      allowsMultipleReviews: next,
                                    });
                                  }}
                                />
                                Varias revisiones
                              </label>
                              {canCreate && (
                                <button
                                  type="button"
                                  disabled={creatingRowId === row.id}
                                  className="block text-xs text-indigo-600 hover:underline disabled:opacity-50"
                                  onClick={() => onCreateRecord!(row)}
                                >
                                  {creatingRowId === row.id
                                    ? "Creando…"
                                    : links.length > 0
                                      ? "Otra revisión"
                                      : "Crear registro"}
                                </button>
                              )}
                              {!canCreate && links.length > 0 && (
                                <span className="block text-[10px] text-muted-foreground">
                                  Vinculada
                                </span>
                              )}
                            </>
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
