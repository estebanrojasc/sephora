"use client";

import { AlertCircle, Check, Save, X, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COPY } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ActionBarProps {
  onSave: () => void;
  onMarkErrors: () => void;
  onReject: () => void;
  loading?: boolean;
  saveDisabled?: boolean;
  saveDisabledReason?: string;
  /** Resumen de validación */
  totalsStatus?: { ok: boolean; message: string } | null;
  /** Si hay cambios sin guardar, resalta el botón Guardar */
  hasUnsavedChanges?: boolean;
}

export function ActionBar({
  onSave,
  onMarkErrors,
  onReject,
  loading,
  saveDisabled,
  saveDisabledReason,
  totalsStatus,
  hasUnsavedChanges,
}: ActionBarProps) {
  return (
    <div className="sticky bottom-0 -mx-4 -mb-4 border-t bg-background/90 backdrop-blur-xl px-4 py-3 sm:-mx-6 sm:px-6">
      {/* Validation summary */}
      {totalsStatus && (
        <div className={cn(
          "mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
          totalsStatus.ok
            ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
            : "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
        )}>
          {totalsStatus.ok ? <Check className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
          {totalsStatus.message}
        </div>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Button
          className="gap-2 bg-emerald-600 text-white shadow-md shadow-emerald-500/20 transition-all hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-500/25 active:scale-[0.97] dark:bg-emerald-700 dark:hover:bg-emerald-600"
          onClick={onSave}
          disabled={loading || saveDisabled}
          title={saveDisabled ? saveDisabledReason : "Guardar registro (Ctrl+S)"}
        >
          <Save className="size-4" />
          {COPY.admin.save}
        </Button>
        <Button
          variant="outline"
          className="gap-2 border-amber-200 bg-amber-50 text-amber-800 shadow-sm transition-all hover:bg-amber-100 hover:shadow-md active:scale-[0.97] dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-950"
          onClick={onMarkErrors}
          disabled={loading}
        >
          <AlertCircle className="size-4" />
          {COPY.admin.markErrors}
        </Button>
        <Button
          variant="outline"
          className="gap-2 border-red-200 bg-red-50 text-red-700 shadow-sm transition-all hover:bg-red-100 hover:shadow-md active:scale-[0.97] dark:border-red-800 dark:bg-red-950/30 dark:text-red-200 dark:hover:bg-red-950"
          onClick={onReject}
          disabled={loading}
        >
          <X className="size-4" />
          {COPY.admin.reject}
        </Button>
      </div>
    </div>
  );
}
