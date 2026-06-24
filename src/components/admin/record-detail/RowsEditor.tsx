"use client";

import { useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Bbox, ExtractedField } from "@/features/records/types";
import { ChileanDateInput } from "./ChileanDateInput";
import { CatalogPicker } from "./CatalogPicker";
import { useActiveCatalogsByField } from "@/features/catalogs/queries";

interface RowsEditorProps<T extends object> {
  rows: T[];
  columns: {
    key: keyof T & string;
    label: string;
    type?: "text" | "date";
    /** `arrayName.columnKey` para buscar un catálogo activo. */
    catalogKey?: string;
  }[];
  createEmpty: () => T;
  onChange: (rows: T[]) => void;
  onHoverBbox?: (bbox: Bbox | null) => void;
}

export function RowsEditor<T extends object>({
  rows,
  columns,
  createEmpty,
  onChange,
  onHoverBbox,
}: RowsEditorProps<T>) {
  const [focusedCell, setFocusedCell] = useState<string | null>(null);
  // Espejo síncrono para evitar la race entre setState (asíncrono) y el
  // onMouseLeave que apaga el zoom antes de que React aplique el focus.
  const focusedCellRef = useRef<string | null>(null);
  const setFocusCell = (next: string | null) => {
    focusedCellRef.current = next;
    setFocusedCell(next);
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

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
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
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="px-2 py-2 text-xs text-muted-foreground"
                >
                  Sin filas
                </td>
              </tr>
            )}
            {rows.map((row, idx) => (
              <tr key={idx} className="border-b last:border-0">
                {columns.map((col) => {
                  const field = (row as unknown as Record<
                    string,
                    ExtractedField
                  >)[col.key];
                  const hasBbox = field.bbox.some((v) => v !== 0);
                  const cellKey = `${idx}:${col.key}`;
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
                  const catalog = col.catalogKey
                    ? catalogs.get(col.catalogKey)
                    : undefined;
                  return (
                    <td
                      key={col.key}
                      className="px-1 py-1"
                      onMouseEnter={() => {
                        if (hasBbox && focusedCellRef.current !== cellKey) {
                          onHoverBbox?.(field.bbox);
                        }
                      }}
                      onMouseLeave={leaveCell}
                    >
                      <div className="flex items-start gap-1">
                        <div className="min-w-0 flex-1">
                          {col.type === "date" ? (
                            <ChileanDateInput
                              value={field.valor}
                              onChange={(value) =>
                                update(idx, col.key, value)
                              }
                              onFocus={focusCell}
                              onBlur={blurCell}
                            />
                          ) : (
                            <Input
                              type="text"
                              value={field.valor}
                              onChange={(e) =>
                                update(idx, col.key, e.target.value)
                              }
                              onFocus={focusCell}
                              onBlur={blurCell}
                              className="h-8 text-sm"
                            />
                          )}
                        </div>
                        {catalog && (
                          <CatalogPicker
                            catalog={catalog}
                            currentValue={field.valor}
                            onPick={(value) => update(idx, col.key, value)}
                          />
                        )}
                      </div>
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
