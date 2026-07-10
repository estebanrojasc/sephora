"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { Record } from "@/features/records/types";
import { downloadRecordExcelWithToast } from "@/features/excel/download-record-excel";
import { cn } from "@/lib/utils";

interface ExcelExportButtonProps {
  record: Record;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
  className?: string;
  /** Solo icono (p. ej. en tabla de cola). */
  iconOnly?: boolean;
}

export function ExcelExportButton({
  record,
  variant = "outline",
  size = "sm",
  className,
  iconOnly = false,
}: ExcelExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const classes = cn(
    buttonVariants({ variant, size }),
    "gap-2",
    iconOnly && size === "sm" && "px-2",
    className
  );

  if (!record.extraction) {
    return (
      <span
        className={cn(classes, "cursor-not-allowed opacity-50")}
        title="Sin extracción — no se puede generar Excel"
      >
        <Download className="size-4" />
        {!iconOnly && "Descargar Excel"}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={classes}
      disabled={loading}
      title="Descargar Excel"
      onClick={async () => {
        setLoading(true);
        try {
          await downloadRecordExcelWithToast(record.id);
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Download className="size-4" />
      )}
      {!iconOnly && (loading ? "Generando…" : "Descargar Excel")}
    </button>
  );
}
