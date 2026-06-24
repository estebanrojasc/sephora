"use client";

import { useRef, useState } from "react";
import { ScanSearch } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Bbox, ExtractedField } from "@/features/records/types";
import { applyManualBboxCorrection } from "@/features/records/bbox-corrections";
import { cn } from "@/lib/utils";
import { useBboxEdit } from "./bbox-edit-context";
import { ChileanDateInput } from "./ChileanDateInput";
import { CatalogPicker } from "./CatalogPicker";
import { useActiveCatalogsByField } from "@/features/catalogs/queries";

interface FieldInputProps {
  label: string;
  value: ExtractedField | undefined;
  onChange: (next: ExtractedField) => void;
  onHover?: (bbox: Bbox | null) => void;
  /**
   * Identificador único del campo dentro del documento. Si se provee y el
   * contexto BboxEdit existe, muestra el botón "Caja" para dibujar el bbox
   * manualmente sobre la imagen.
   */
  editKey?: string;
  /**
   * Clave del campo para vincular con un catálogo. Ej: "conductor",
   * "auxiliar", "detalles_cheques.banco".
   */
  catalogKey?: string;
  type?: "text" | "date" | "number";
  className?: string;
  /** Resalta el input cuando falta total o hay descuadre con la suma de filas. */
  highlight?: "missing" | "mismatch";
}

export function FieldInput({
  label,
  value,
  onChange,
  onHover,
  editKey,
  catalogKey,
  type = "text",
  className,
  highlight,
}: FieldInputProps) {
  const current: ExtractedField = value ?? { valor: "", bbox: [0, 0, 0, 0] };
  const hasBbox = current.bbox.some((v) => v !== 0);
  const [focused, setFocused] = useState(false);
  // Espejo síncrono de `focused`: React batch-ea el setState y el onMouseLeave
  // del div lo lee en el render anterior, por lo que sin ref el zoom se sale
  // si el mouse abandona la caja antes del re-render.
  const focusedRef = useRef(false);
  const setFocus = (next: boolean) => {
    focusedRef.current = next;
    setFocused(next);
  };
  const bboxEdit = useBboxEdit();
  const showEditButton = Boolean(bboxEdit && editKey);
  const isEditingBbox = bboxEdit?.activeId === editKey;
  const catalogs = useActiveCatalogsByField();
  const catalog = catalogKey ? catalogs.get(catalogKey) : undefined;

  const highlightClass =
    highlight === "missing"
      ? "border-red-500 bg-red-50 ring-1 ring-red-400 dark:border-red-600 dark:bg-red-950/30 dark:ring-red-700"
      : highlight === "mismatch"
        ? "border-red-500 bg-red-50/80 ring-1 ring-red-400 dark:border-red-600 dark:bg-red-950/20 dark:ring-red-700"
        : undefined;

  return (
    <div
      className={cn("space-y-1.5", className)}
      onMouseEnter={() =>
        hasBbox && !focusedRef.current && onHover?.(current.bbox)
      }
      onMouseLeave={() => {
        if (!focusedRef.current) onHover?.(null);
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <Label
          className={cn(
            "text-xs font-medium text-muted-foreground",
            highlight && "font-semibold text-red-700 dark:text-red-300"
          )}
        >
          {label}
        </Label>
        {showEditButton && bboxEdit && editKey && (
          <Button
            type="button"
            size="sm"
            variant={isEditingBbox ? "default" : "outline"}
            className="h-6 px-1.5 text-[10px]"
            onClick={() =>
              bboxEdit.requestEdit(editKey, (newBbox) =>
                onChange(applyManualBboxCorrection(current, newBbox))
              )
            }
            title={
              isEditingBbox
                ? "Haz click y arrastra sobre la imagen…"
                : "Marcar manualmente sobre la imagen"
            }
          >
            <ScanSearch className="size-3" />
            {isEditingBbox ? "Dibuja…" : hasBbox ? "Editar caja" : "Marcar caja"}
          </Button>
        )}
      </div>
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          {type === "date" ? (
            <ChileanDateInput
              value={current.valor}
              onChange={(valor) => onChange({ ...current, valor })}
              onFocus={() => {
                setFocus(true);
                if (hasBbox) onHover?.(current.bbox);
              }}
              onBlur={() => {
                setFocus(false);
                onHover?.(null);
              }}
              onMouseEnter={() => {
                if (hasBbox) onHover?.(current.bbox);
              }}
              onMouseLeave={() => {
                if (!focusedRef.current) onHover?.(null);
              }}
            />
          ) : (
            <Input
              type="text"
              value={current.valor}
              onChange={(e) =>
                onChange({ ...current, valor: e.target.value })
              }
              onFocus={() => {
                setFocus(true);
                if (hasBbox) onHover?.(current.bbox);
              }}
              onBlur={() => {
                setFocus(false);
                onHover?.(null);
              }}
              className={cn(
                "h-8 text-sm",
                type === "number" && "text-right tabular-nums",
                highlightClass
              )}
            />
          )}
        </div>
        {catalog && (
          <CatalogPicker
            catalog={catalog}
            currentValue={current.valor}
            onPick={(valor) => onChange({ ...current, valor })}
          />
        )}
      </div>
      {current.bboxCorrection && (
        <p className="text-[10px] text-muted-foreground">
          Caja manual · Δ centro{" "}
          {Math.round(current.bboxCorrection.delta.centerX)},{" "}
          {Math.round(current.bboxCorrection.delta.centerY)}
        </p>
      )}
    </div>
  );
}
