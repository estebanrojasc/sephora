"use client";

import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
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
  shouldOfferCreateRecordFromBitacoraRow,
  type BitacoraRowRecordLink,
} from "@/features/bitacora/row-links";
import { StatusBadge } from "@/components/common/StatusBadge";
import { BitacoraRowBadge } from "./BitacoraRowBadge";
import { cn } from "@/lib/utils";

function isCellEditable(_row: BitacoraRow, readOnly: boolean): boolean {
  return !readOnly;
}

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
  onDeleteRow?: (rowId: string) => void;
  deletingRowId?: string | null;
  creatingRowId?: string | null;
  readOnly?: boolean;
  rowRecordLinks?: Map<string, BitacoraRowRecordLink[]>;
  onToggleMultipleReviews?: (
    rowId: string,
    allowsMultipleReviews: boolean
  ) => void;
}

interface RowContext {
  row: BitacoraRow;
  idx: number;
  readOnly: boolean;
  updateRow: (idx: number, patch: Partial<BitacoraRow>) => void;
  updateCell: (idx: number, key: keyof BitacoraRow, value: string) => void;
}

function BitacoraRowTypeField({
  row,
  idx,
  readOnly,
  updateRow,
}: RowContext) {
  if (readOnly) {
    return (
      <BitacoraRowBadge
        rowType={row.rowType}
        manualSubtype={row.manualSubtype}
      />
    );
  }

  return (
    <Select
      value={row.rowType}
      onValueChange={(v) =>
        updateRow(idx, {
          rowType: v as BitacoraRowType,
        })
      }
    >
      <SelectTrigger className="h-8 w-full text-xs lg:h-7 lg:w-[130px]">
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
  );
}

function BitacoraCellEditor({
  row,
  col,
  idx,
  readOnly,
  updateCell,
}: RowContext & { col: (typeof COLUMNS)[number] }) {
  if (!isCellEditable(row, readOnly)) {
    return (
      <span className="text-xs">
        {col.key === "recorrido"
          ? (bitacoraRecorridoCanonical(row) ?? "—")
          : col.key === "scheduledDate"
            ? (row.scheduledDate ?? "—")
            : ((row[col.key] as string | undefined) ?? "—")}
      </span>
    );
  }

  if (col.key === "scheduledDate") {
    return (
      <Input
        type="date"
        className={cn(
          "h-8 w-full text-xs lg:h-7 lg:min-w-[120px]",
          row.rowType === "entrega_pendiente" &&
            !row.scheduledDate &&
            "border-amber-500 ring-1 ring-amber-500/40"
        )}
        value={row.scheduledDate ?? ""}
        onChange={(e) => updateCell(idx, "scheduledDate", e.target.value)}
      />
    );
  }

  return (
    <Input
      className="h-8 w-full text-xs lg:h-7 lg:min-w-[72px]"
      value={
        col.key === "recorrido"
          ? (row.recorrido ?? row.recorridoSuffix ?? "")
          : ((row[col.key] as string | undefined) ?? "")
      }
      onChange={(e) =>
        updateCell(
          idx,
          col.key === "recorrido" ? "recorrido" : col.key,
          e.target.value
        )
      }
    />
  );
}

function BitacoraRowLinks({ links }: { links: BitacoraRowRecordLink[] }) {
  const confirmed = links.filter((l) => l.confirmed);
  if (confirmed.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">Sin registro</span>
    );
  }

  return (
    <ul className="space-y-1">
      {confirmed.map((link) => (
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
  );
}

function BitacoraRowActions({
  row,
  idx,
  readOnly,
  links,
  allowsMultiple,
  canCreate,
  showCreate,
  creatingRowId,
  onCreateRecord,
  onToggleMultipleReviews,
  updateRow,
}: RowContext & {
  links: BitacoraRowRecordLink[];
  allowsMultiple: boolean;
  canCreate: boolean;
  showCreate: boolean;
  creatingRowId?: string | null;
  onCreateRecord?: (row: BitacoraRow) => void;
  onToggleMultipleReviews?: (
    rowId: string,
    allowsMultipleReviews: boolean
  ) => void;
}) {
  if (
    row.rowType !== "manual" &&
    row.rowType !== "ruta" &&
    row.rowType !== "entrega_pendiente"
  ) {
    return null;
  }

  const hasConfirmed = links.some((l) => l.confirmed);
  const awaitingConductorUpload =
    row.rowType === "ruta" && !hasConfirmed && readOnly;

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <input
          type="checkbox"
          className="size-3.5 rounded border"
          checked={allowsMultiple}
          disabled={readOnly && !onToggleMultipleReviews}
          onChange={(e) => {
            const next = e.target.checked;
            if (onToggleMultipleReviews) {
              onToggleMultipleReviews(row.id, next);
              return;
            }
            updateRow(idx, { allowsMultipleReviews: next });
          }}
        />
        Varias revisiones
      </label>
      {showCreate && onCreateRecord && (
        <button
          type="button"
          disabled={
            creatingRowId === row.id ||
            (row.rowType === "entrega_pendiente" &&
              !row.scheduledDate?.trim())
          }
          className="block text-xs text-indigo-600 hover:underline disabled:opacity-50 disabled:no-underline"
          title={
            row.rowType === "entrega_pendiente" &&
            !row.scheduledDate?.trim()
              ? "Indica la fecha programada primero"
              : undefined
          }
          onClick={() => onCreateRecord(row)}
        >
          {creatingRowId === row.id
            ? "Creando…"
            : hasConfirmed
              ? "Otra revisión"
              : "Crear registro"}
        </button>
      )}
      {awaitingConductorUpload && (
        <span className="block text-[10px] text-muted-foreground">
          Se vincula al subir fotos del conductor
        </span>
      )}
      {!canCreate && hasConfirmed && (
        <span className="block text-[10px] text-muted-foreground">
          Vinculada
        </span>
      )}
    </div>
  );
}

function BitacoraPreviewRowCard({
  ctx,
  links,
  showLinksColumn,
  showRowSettingsColumn,
  onToggleMultipleReviews,
  onCreateRecord,
  onDeleteRow,
  creatingRowId,
  deletingRowId,
}: {
  ctx: RowContext;
  links: BitacoraRowRecordLink[];
  showLinksColumn: boolean;
  showRowSettingsColumn: boolean;
  onToggleMultipleReviews?: (
    rowId: string,
    allowsMultipleReviews: boolean
  ) => void;
  onCreateRecord?: (row: BitacoraRow) => void;
  onDeleteRow?: (rowId: string) => void;
  creatingRowId?: string | null;
  deletingRowId?: string | null;
}) {
  const { row, readOnly } = ctx;
  const recorrido = bitacoraRecorridoCanonical(row);
  const allowsMultiple = rowAllowsMultipleReviews(row);
  const canCreate = Boolean(
    onCreateRecord && canCreateRecordForBitacoraRow(row, links)
  );
  const showCreate = Boolean(
    onCreateRecord && shouldOfferCreateRecordFromBitacoraRow(row, links)
  );

  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <BitacoraRowTypeField {...ctx} />
          {recorrido && (
            <p className="truncate text-sm font-semibold">{recorrido}</p>
          )}
        </div>
        {!readOnly && onDeleteRow && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 shrink-0 gap-1 text-destructive hover:text-destructive"
            disabled={deletingRowId === row.id}
            onClick={() => onDeleteRow(row.id)}
          >
            <Trash2 className="size-3.5" />
            Eliminar
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        {COLUMNS.map((col) => (
          <div
            key={col.key}
            className={cn(
              "min-w-0",
              col.key === "observacion" && "col-span-2"
            )}
          >
            <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              {col.label}
            </dt>
            <dd className="mt-0.5">
              <BitacoraCellEditor {...ctx} col={col} />
            </dd>
          </div>
        ))}
      </dl>

      {showLinksColumn && (
        <div className="mt-3 border-t pt-3">
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Revisiones
          </p>
          <BitacoraRowLinks links={links} />
        </div>
      )}

      {showRowSettingsColumn && (
        <div className="mt-3 border-t pt-3">
          <BitacoraRowActions
            {...ctx}
            links={links}
            allowsMultiple={allowsMultiple}
            canCreate={canCreate}
            showCreate={showCreate}
            creatingRowId={creatingRowId}
            onCreateRecord={onCreateRecord}
            onToggleMultipleReviews={onToggleMultipleReviews}
          />
        </div>
      )}
    </div>
  );
}

export function BitacoraPreviewTable({
  rows,
  onChange,
  onCreateRecord,
  onDeleteRow,
  deletingRowId,
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

  const removeRowLocal = (rowId: string) => {
    if (onDeleteRow) {
      onDeleteRow(rowId);
      return;
    }
    onChange(rows.filter((r) => r.id !== rowId));
  };

  const rutas = rows.filter((r) => r.rowType === "ruta");
  const pendientes = rows.filter((r) => r.rowType === "entrega_pendiente");
  const manuales = rows.filter((r) => r.rowType === "manual");
  const otros = rows.filter(
    (r) => !["ruta", "entrega_pendiente", "manual"].includes(r.rowType)
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
  const showDeleteColumn = !readOnly;

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
          {section.title.startsWith("Entregas pendientes") && !readOnly && (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Completa la columna «Fecha prog.» si vas a crear un borrador en
              Guardados.
            </p>
          )}

          {/* Vista móvil / tablet: cards apiladas (< lg) */}
          <div className="space-y-3 lg:hidden">
            {section.items.map((row) => {
              const idx = rows.findIndex((r) => r.id === row.id);
              const links = rowRecordLinks?.get(row.id) ?? [];
              const ctx: RowContext = {
                row,
                idx,
                readOnly,
                updateRow,
                updateCell,
              };
              return (
                <BitacoraPreviewRowCard
                  key={row.id}
                  ctx={ctx}
                  links={links}
                  showLinksColumn={showLinksColumn}
                  showRowSettingsColumn={showRowSettingsColumn}
                  onToggleMultipleReviews={onToggleMultipleReviews}
                  onCreateRecord={onCreateRecord}
                  onDeleteRow={removeRowLocal}
                  creatingRowId={creatingRowId}
                  deletingRowId={deletingRowId}
                />
              );
            })}
          </div>

          {/* Vista desktop: tabla ancha (≥ lg) */}
          <div className="hidden overflow-x-auto rounded-md border lg:block">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-2 py-1.5 text-left text-xs font-medium">
                    Tipo
                  </th>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="whitespace-nowrap px-2 py-1.5 text-left text-xs font-medium"
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
                  {showDeleteColumn && (
                    <th className="px-2 py-1.5 text-xs font-medium"> </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {section.items.map((row) => {
                  const idx = rows.findIndex((r) => r.id === row.id);
                  const links = rowRecordLinks?.get(row.id) ?? [];
                  const canCreate = Boolean(
                    onCreateRecord &&
                      canCreateRecordForBitacoraRow(row, links)
                  );
                  const showCreate = Boolean(
                    onCreateRecord &&
                      shouldOfferCreateRecordFromBitacoraRow(row, links)
                  );
                  const allowsMultiple = rowAllowsMultipleReviews(row);
                  const ctx: RowContext = {
                    row,
                    idx,
                    readOnly,
                    updateRow,
                    updateCell,
                  };

                  return (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-2 py-1 align-top">
                        <BitacoraRowTypeField {...ctx} />
                      </td>
                      {COLUMNS.map((col) => (
                        <td key={col.key} className="px-1 py-1">
                          <BitacoraCellEditor {...ctx} col={col} />
                        </td>
                      ))}
                      {showLinksColumn && (
                        <td className="px-2 py-1 align-top">
                          <BitacoraRowLinks links={links} />
                        </td>
                      )}
                      {(showRowSettingsColumn || onToggleMultipleReviews) && (
                        <td className="space-y-2 px-2 py-1 align-top">
                          <BitacoraRowActions
                            {...ctx}
                            links={links}
                            allowsMultiple={allowsMultiple}
                            canCreate={canCreate}
                            showCreate={showCreate}
                            creatingRowId={creatingRowId}
                            onCreateRecord={onCreateRecord}
                            onToggleMultipleReviews={onToggleMultipleReviews}
                          />
                        </td>
                      )}
                      {showDeleteColumn && (
                        <td className="px-1 py-1 align-top">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            disabled={deletingRowId === row.id}
                            title="Eliminar fila"
                            onClick={() => removeRowLocal(row.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
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
