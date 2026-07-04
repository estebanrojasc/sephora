"use client";

import { useRef, useState } from "react";
import { ScanSearch, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import type { Bbox, ExtractedField } from "@/features/records/types";
import { applyManualBboxCorrection } from "@/features/records/bbox-corrections";
import { cn } from "@/lib/utils";
import { useBboxEdit } from "./bbox-edit-context";
import { ChileanDateInput } from "./ChileanDateInput";

interface FieldInputProps {
  label: string;
  value: ExtractedField | undefined;
  onChange: (next: ExtractedField) => void;
  onHover?: (bbox: Bbox | null) => void;
  editKey?: string;
  catalogKey?: string;
  type?: "text" | "date" | "number";
  className?: string;
  highlight?: "missing" | "mismatch";
  /** Nivel de confianza IA (0-100), si está disponible desde _meta */
  confidence?: number;
}

export function FieldInput({
  label,
  value,
  onChange,
  onHover,
  editKey,
  catalogKey: _catalogKey,
  type = "text",
  className,
  highlight,
  confidence,
}: FieldInputProps) {
  const current: ExtractedField = value ?? { valor: "", bbox: [0, 0, 0, 0] };
  const hasBbox = current.bbox.some((v) => v !== 0);
  const [focused, setFocused] = useState(false);
  const focusedRef = useRef(false);
  const setFocus = (next: boolean) => { focusedRef.current = next; setFocused(next); };
  const bboxEdit = useBboxEdit();
  const showEditButton = Boolean(bboxEdit && editKey);
  const isEditingBbox = bboxEdit?.activeId === editKey;

  const highlightClass =
    highlight === "missing"
      ? "border-red-500 bg-red-50 ring-1 ring-red-400 dark:border-red-600 dark:bg-red-950/30 dark:ring-red-700"
      : highlight === "mismatch"
        ? "border-red-500 bg-red-50/80 ring-1 ring-red-400 dark:border-red-600 dark:bg-red-950/20 dark:ring-red-700"
        : undefined;

  return (
    <div className={cn("space-y-1.5", className)}
      onMouseEnter={() => hasBbox && !focusedRef.current && onHover?.(current.bbox)}
      onMouseLeave={() => { if (!focusedRef.current) onHover?.(null); }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Label className={cn("text-xs font-medium text-muted-foreground truncate", highlight && "font-semibold text-red-700 dark:text-red-300")}>
            {label}
          </Label>
          {/* Confidence badge */}
          {confidence != null && confidence > 0 && (
            <span className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-px text-[10px] font-medium shrink-0",
              confidence >= 80 ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" :
              confidence >= 50 ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" :
              "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
            )}>
              <Sparkles className="size-2.5" />{confidence}%
            </span>
          )}
        </div>
        {showEditButton && bboxEdit && editKey && (
          <Button type="button" size="sm" variant={isEditingBbox ? "default" : "outline"}
            className="h-6 px-1.5 text-[10px] shrink-0"
            onClick={() => bboxEdit.requestEdit(editKey, (newBbox) => onChange(applyManualBboxCorrection(current, newBbox)))}
            title={isEditingBbox ? "Dibuja sobre la imagen…" : hasBbox ? "Editar caja" : "Marcar caja"}>
            <ScanSearch className="size-3" />
            {isEditingBbox ? "Dibujando…" : hasBbox ? "Caja" : "Marcar"}
          </Button>
        )}
      </div>
      <div className="flex items-start gap-1.5">
        <div className="min-w-0 flex-1">
          {type === "date" ? (
            <ChileanDateInput value={current.valor} onChange={(valor) => onChange({ ...current, valor })}
              onFocus={() => { setFocus(true); if (hasBbox) onHover?.(current.bbox); }}
              onBlur={() => { setFocus(false); onHover?.(null); }}
              onMouseEnter={() => { if (hasBbox) onHover?.(current.bbox); }}
              onMouseLeave={() => { if (!focusedRef.current) onHover?.(null); }} />
          ) : (
            <Input type="text" value={current.valor} onChange={(e) => onChange({ ...current, valor: e.target.value })}
              onFocus={() => { setFocus(true); if (hasBbox) onHover?.(current.bbox); }}
              onBlur={() => { setFocus(false); onHover?.(null); }}
              className={cn("h-8 text-sm", type === "number" && "text-right tabular-nums", highlightClass)} />
          )}
        </div>
      </div>
      {current.bboxCorrection && (
        <p className="text-[10px] text-muted-foreground">Caja manual · Δ centro {Math.round(current.bboxCorrection.delta.centerX)}, {Math.round(current.bboxCorrection.delta.centerY)}</p>
      )}
    </div>
  );
}
