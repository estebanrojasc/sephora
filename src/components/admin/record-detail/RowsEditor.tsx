"use client";

import { useRef, type RefObject } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Bbox, ExtractedField } from "@/features/records/types";
import { ChileanDateInput } from "./ChileanDateInput";
import { useActiveCatalogsByField } from "@/features/catalogs/queries";
import type { Catalog } from "@/features/catalogs/types";
import {
  resolveCatalogDisplayValue,
  resolveCatalogStoredValue,
} from "@/features/catalogs/resolve";
import { transferBankDisplayLabel } from "@/features/records/transfer-bank";
import { normalizeThousandsDisplay } from "@/lib/parse-number";

const TRANSFER_BANK_CATALOG_KEY = "detalle_transferencias.banco";

function cellDisplayValue(
  catalogKey: string | undefined,
  catalog: Catalog | undefined,
  raw: string
): string {
  if (catalogKey === TRANSFER_BANK_CATALOG_KEY) {
    return transferBankDisplayLabel(raw);
  }
  if (catalog) return resolveCatalogDisplayValue(catalog, raw);
  return raw;
}

function cellStoredValue(
  catalogKey: string | undefined,
  catalog: Catalog | undefined,
  raw: string
): string {
  if (catalogKey === TRANSFER_BANK_CATALOG_KEY) {
    if (catalog) return resolveCatalogStoredValue(catalog, raw);
    return transferBankDisplayLabel(raw) || raw;
  }
  if (catalog) return resolveCatalogStoredValue(catalog, raw);
  return raw;
}

type ColumnDef<T extends object> = {
  key: keyof T & string;
  label: string;
  type?: "text" | "date";
  catalogKey?: string;
};

interface RowsEditorProps<T extends object> {
  rows: T[];
  columns: ColumnDef<T>[];
  createEmpty: () => T;
  onChange: (rows: T[]) => void;
  onHoverBbox?: (bbox: Bbox | null) => void;
  filter?: (row: T, index: number) => boolean;
}

interface CellEditorProps<T extends object> {
  rowIndex: number;
  col: ColumnDef<T>;
  field: ExtractedField;
  catalog: Catalog | undefined;
  focusedCellRef: RefObject<string | null>;
  setFocusCell: (next: string | null) => void;
  onHoverBbox?: (bbox: Bbox | null) => void;
  onUpdate: (idx: number, key: keyof T & string, valor: string) => void;
  /** Envuelve el input en contenedor con handlers de hover (solo tabla desktop). */
  withHoverWrapper?: boolean;
}

function RowsEditorCell<T extends object>({
  rowIndex,
  col,
  field,
  catalog,
  focusedCellRef,
  setFocusCell,
  onHoverBbox,
  onUpdate,
  withHoverWrapper = false,
}: CellEditorProps<T>) {
  const hasBbox = field.bbox.some((v) => v !== 0);
  const cellKey = `${rowIndex}:${col.key}`;

  const focusCell = () => {
    setFocusCell(cellKey);
    if (hasBbox) onHoverBbox?.(field.bbox);
  };

  const blurCell = () => {
    setFocusCell(null);
    onHoverBbox?.(null);
  };

  const leaveCell = () => {
    if (focusedCellRef.current !== cellKey) {
      onHoverBbox?.(null);
    }
  };

  const input =
    col.type === "date" ? (
      <ChileanDateInput
        value={field.valor}
        onChange={(value) => onUpdate(rowIndex, col.key, value)}
        onFocus={focusCell}
        onBlur={blurCell}
      />
    ) : (
      <Input
        type="text"
        value={cellDisplayValue(col.catalogKey, catalog, field.valor)}
        onChange={(e) =>
          onUpdate(
            rowIndex,
            col.key,
            cellStoredValue(col.catalogKey, catalog, e.target.value)
          )
        }
        onFocus={focusCell}
        onBlur={() => {
          blurCell();
          if (col.key === "valor" && field.valor.trim()) {
            onUpdate(
              rowIndex,
              col.key,
              normalizeThousandsDisplay(field.valor)
            );
          }
        }}
        className="h-8 w-full text-sm"
      />
    );

  if (!withHoverWrapper) {
    return <div className="min-w-0">{input}</div>;
  }

  return (
    <div
      className="min-w-0"
      onMouseEnter={() => {
        if (hasBbox && focusedCellRef.current !== cellKey) {
          onHoverBbox?.(field.bbox);
        }
      }}
      onMouseLeave={leaveCell}
    >
      {input}
    </div>
  );
}

interface RowCardProps<T extends object> {
  rowIndex: number;
  displayIndex: number;
  row: T;
  columns: ColumnDef<T>[];
  catalogs: Map<string, Catalog>;
  focusedCellRef: RefObject<string | null>;
  setFocusCell: (next: string | null) => void;
  onHoverBbox?: (bbox: Bbox | null) => void;
  onUpdate: (idx: number, key: keyof T & string, valor: string) => void;
  onRemove: (idx: number) => void;
}

function RowsEditorRowCard<T extends object>({
  rowIndex,
  displayIndex,
  row,
  columns,
  catalogs,
  focusedCellRef,
  setFocusCell,
  onHoverBbox,
  onUpdate,
  onRemove,
}: RowCardProps<T>) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Fila {displayIndex + 1}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onRemove(rowIndex)}
          aria-label="Eliminar fila"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5">
        {columns.map((col) => {
          const field = (row as unknown as Record<string, ExtractedField>)[
            col.key
          ];
          const catalog = col.catalogKey
            ? catalogs.get(col.catalogKey)
            : undefined;

          return (
            <div
              key={col.key}
              className="min-w-0 col-span-2 sm:col-span-1"
            >
              <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {col.label}
              </dt>
              <dd className="mt-0.5">
                <RowsEditorCell
                  rowIndex={rowIndex}
                  col={col}
                  field={field}
                  catalog={catalog}
                  focusedCellRef={focusedCellRef}
                  setFocusCell={setFocusCell}
                  onHoverBbox={onHoverBbox}
                  onUpdate={onUpdate}
                />
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export function RowsEditor<T extends object>({
  rows,
  columns,
  createEmpty,
  onChange,
  onHoverBbox,
  filter,
}: RowsEditorProps<T>) {
  const focusedCellRef = useRef<string | null>(null);
  const setFocusCell = (next: string | null) => {
    focusedCellRef.current = next;
  };
  const catalogs = useActiveCatalogsByField();

  const update = (idx: number, key: keyof T & string, valor: string) => {
    const next = [...rows];
    const row = next[idx] as unknown as Record<string, ExtractedField>;
    next[idx] = {
      ...next[idx],
      [key]: { ...row[key], valor },
    };
    onChange(next);
  };

  const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));
  const add = () => onChange([...rows, createEmpty()]);

  const visibleRows = filter
    ? rows
        .map((row, index) => ({ row, index }))
        .filter(({ row, index }) => filter(row, index))
    : rows.map((row, index) => ({ row, index }));

  const sharedCellProps = {
    focusedCellRef,
    setFocusCell,
    onHoverBbox,
    onUpdate: update,
    catalogs,
    columns,
    onRemove: remove,
  };

  return (
    <div className="space-y-2">
      {visibleRows.length === 0 && (
        <p className="text-xs text-muted-foreground lg:hidden">Sin filas</p>
      )}

      {/* Vista móvil / tablet: cards (< lg) */}
      <div className="space-y-3 lg:hidden">
        {visibleRows.map(({ row, index: idx }, displayIndex) => (
          <RowsEditorRowCard
            key={idx}
            rowIndex={idx}
            displayIndex={displayIndex}
            row={row}
            {...sharedCellProps}
          />
        ))}
      </div>

      {/* Vista desktop: tabla (≥ lg) */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-2 py-1 text-left text-xs font-medium text-muted-foreground"
                >
                  {col.label}
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-2 py-2 text-xs text-muted-foreground"
                >
                  Sin filas
                </td>
              </tr>
            )}
            {visibleRows.map(({ row, index: idx }) => (
              <tr key={idx} className="border-b last:border-0">
                {columns.map((col) => {
                  const field = (row as unknown as Record<
                    string,
                    ExtractedField
                  >)[col.key];
                  const catalog = col.catalogKey
                    ? catalogs.get(col.catalogKey)
                    : undefined;

                  return (
                    <td key={col.key} className="px-1 py-1">
                      <RowsEditorCell
                        rowIndex={idx}
                        col={col}
                        field={field}
                        catalog={catalog}
                        focusedCellRef={focusedCellRef}
                        setFocusCell={setFocusCell}
                        onHoverBbox={onHoverBbox}
                        onUpdate={update}
                        withHoverWrapper
                      />
                    </td>
                  );
                })}
                <td className="px-1 py-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(idx)}
                    aria-label="Eliminar fila"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={add}>
        <Plus className="size-3.5" />
        Agregar fila
      </Button>
    </div>
  );
}
