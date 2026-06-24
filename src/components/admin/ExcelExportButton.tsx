"use client";

import { Download } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { Record } from "@/features/records/types";
import { cn } from "@/lib/utils";

interface ExcelExportButtonProps {
  record: Record;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
}

export function ExcelExportButton({
  record,
  variant = "outline",
  size = "sm",
}: ExcelExportButtonProps) {
  const className = cn(buttonVariants({ variant, size }), "gap-2");

  if (!record.extraction) {
    return (
      <span className={cn(className, "cursor-not-allowed opacity-50")}>
        <Download className="size-4" />
        Descargar Excel
      </span>
    );
  }

  // Usamos <a download> en lugar de <Link>: Next intenta hacer navegación
  // client-side al usar Link, pero la respuesta del API es un binario, así
  // que el indicador "Rendering..." se queda esperando una página que
  // nunca llega. Con <a download> el navegador descarga directamente.
  return (
    <a
      href={`/api/records/${record.id}/excel`}
      className={className}
      download
    >
      <Download className="size-4" />
      Descargar Excel
    </a>
  );
}
