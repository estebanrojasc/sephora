"use client";

import { FileText } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { Record } from "@/features/records/types";
import { cn } from "@/lib/utils";

interface PdfExportButtonProps {
  record: Record;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm";
}

/**
 * Abre el reporte ejecutivo (HTML imprimible) en una nueva pestaña.
 * Desde ahí el usuario imprime con Ctrl+P y guarda como PDF.
 */
export function PdfExportButton({
  record,
  variant = "outline",
  size = "sm",
}: PdfExportButtonProps) {
  return (
    <Link
      href={`/admin/records/${record.id}/reporte`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant, size }), "gap-2")}
    >
      <FileText className="size-4" />
      Reporte ejecutivo
    </Link>
  );
}
