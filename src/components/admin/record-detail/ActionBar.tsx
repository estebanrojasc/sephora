"use client";

import { AlertCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COPY } from "@/lib/constants";

interface ActionBarProps {
  onSave: () => void;
  onMarkErrors: () => void;
  onReject: () => void;
  loading?: boolean;
  /** Cuando es true, deshabilita "Guardar" mostrando el motivo en title. */
  saveDisabled?: boolean;
  saveDisabledReason?: string;
}

export function ActionBar({
  onSave,
  onMarkErrors,
  onReject,
  loading,
  saveDisabled,
  saveDisabledReason,
}: ActionBarProps) {
  return (
    <div className="grid grid-cols-1 gap-2 border-t pt-4 sm:grid-cols-3">
      <Button
        className="gap-2 bg-emerald-600 text-white shadow-sm hover:bg-emerald-500 dark:bg-emerald-700 dark:hover:bg-emerald-600"
        onClick={onSave}
        disabled={loading || saveDisabled}
        title={saveDisabled ? saveDisabledReason : undefined}
      >
        <Check className="size-4" />
        {COPY.admin.save}
      </Button>
      <Button
        variant="outline"
        className="gap-2 border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/60 dark:text-amber-200 dark:hover:bg-amber-950"
        onClick={onMarkErrors}
        disabled={loading}
      >
        <AlertCircle className="size-4" />
        {COPY.admin.markErrors}
      </Button>
      <Button
        variant="outline"
        className="gap-2 border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 dark:hover:bg-red-950"
        onClick={onReject}
        disabled={loading}
      >
        <X className="size-4" />
        {COPY.admin.reject}
      </Button>
    </div>
  );
}
