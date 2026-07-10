"use client";

import Link from "next/link";
import {
  FileText,
  MoreHorizontal,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { buttonVariants } from "@/components/ui/button";
import { ExcelExportButton } from "@/components/admin/ExcelExportButton";
import type { Record } from "@/features/records/types";
import { cn } from "@/lib/utils";
import { AdminRecordMediaActions } from "./AdminRecordMediaActions";

interface RecordDetailActionsProps {
  record: Record;
  hoverBboxEnabled: boolean;
  onHoverBboxEnabledChange: (enabled: boolean) => void;
  calibrationMode: boolean;
  onCalibrationModeChange: (enabled: boolean) => void;
}

function PdfExportLink({
  record,
  className,
}: {
  record: Record;
  className?: string;
}) {
  return (
    <Link
      href={`/admin/records/${record.id}/reporte`}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      <FileText className="size-4" />
      Reporte ejecutivo
    </Link>
  );
}

export function RecordDetailActions({
  record,
  hoverBboxEnabled,
  onHoverBboxEnabledChange,
  calibrationMode,
  onCalibrationModeChange,
}: RecordDetailActionsProps) {
  const hasExtraction = Boolean(record.extraction);

  return (
    <>
      <div className="hidden flex-wrap items-center gap-2 lg:flex">
        <Button
          variant={hoverBboxEnabled ? "default" : "outline"}
          size="sm"
          onClick={() => onHoverBboxEnabledChange(!hoverBboxEnabled)}
          disabled={!hasExtraction}
          title="Resaltar una caja al pasar el mouse sobre un campo"
        >
          {hoverBboxEnabled ? "Resaltado activo" : "Resaltado off"}
        </Button>
        <Button
          variant={calibrationMode ? "default" : "outline"}
          size="sm"
          onClick={() => onCalibrationModeChange(!calibrationMode)}
          disabled={!hasExtraction}
          title="Pintar todas las cajas detectadas por la IA"
        >
          <ScanLine className="size-4" />
          {calibrationMode ? "Ocultar cajas" : "Ver todas las cajas"}
        </Button>
        <PdfExportLink
          record={record}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2")}
        />
        <ExcelExportButton record={record} />
        <AdminRecordMediaActions record={record} />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="outline"
              size="sm"
              className="gap-2 lg:hidden"
              aria-label="Más acciones"
            >
              <MoreHorizontal className="size-4" />
              Acciones
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuCheckboxItem
            checked={hoverBboxEnabled}
            disabled={!hasExtraction}
            onCheckedChange={(checked) => onHoverBboxEnabledChange(Boolean(checked))}
          >
            Resaltado al pasar
          </DropdownMenuCheckboxItem>
          <DropdownMenuCheckboxItem
            checked={calibrationMode}
            disabled={!hasExtraction}
            onCheckedChange={(checked) => onCalibrationModeChange(Boolean(checked))}
          >
            Ver todas las cajas
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            render={
              <PdfExportLink
                record={record}
                className="flex w-full items-center gap-2"
              />
            }
          />
          <div className="px-2 py-1.5">
            <ExcelExportButton record={record} className="w-full justify-start" />
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="flex flex-wrap items-center gap-2 lg:hidden">
        <AdminRecordMediaActions record={record} />
      </div>
    </>
  );
}
