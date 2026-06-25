"use client";

import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, BookOpen, Eye, FileSpreadsheet } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/StatusBadge";
import { RecordSummaryCard } from "@/components/common/RecordSummaryCard";
import { PdfExportButton } from "@/components/admin/PdfExportButton";
import { BulkExcelExportDialog } from "@/components/admin/BulkExcelExportDialog";
import type { Record } from "@/features/records/types";
import type { Bitacora } from "@/features/bitacora/types";
import { getRecordConductorLabel } from "@/features/records/display";
import { matchScoreForRecord } from "@/features/bitacora/match";
import { formatDate } from "@/lib/format";
import { formatExtractedDateChilean } from "@/lib/date-utils";
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";
import { duplicateRecorridoKeys } from "@/features/records/filter-by-day";

interface RecordsTableProps {
  records: Record[];
  isLoading?: boolean;
  /** Habilita selección múltiple y export Excel consolidado (tab Guardado). */
  enableBulkExcel?: boolean;
  /** Bitácora activa del día filtrado (para indicador de match). */
  activeBitacora?: Bitacora | null;
}

export function RecordsTable({
  records,
  isLoading,
  enableBulkExcel = false,
  activeBitacora = null,
}: RecordsTableProps) {
  const isDesktop = useIsDesktop();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: false },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [bulkOpen, setBulkOpen] = useState(false);

  const selectedRecords = useMemo(
    () => records.filter((r) => rowSelection[r.id]),
    [records, rowSelection]
  );

  const duplicateRecorridos = useMemo(
    () => duplicateRecorridoKeys(records),
    [records]
  );

  const columns = useMemo<ColumnDef<Record>[]>(() => {
    const base: ColumnDef<Record>[] = [];

    if (enableBulkExcel) {
      base.push({
        id: "select",
        header: ({ table }) => (
          <input
            type="checkbox"
            className="size-4 rounded border"
            checked={table.getIsAllPageRowsSelected()}
            ref={(el) => {
              if (el) {
                el.indeterminate =
                  table.getIsSomePageRowsSelected() &&
                  !table.getIsAllPageRowsSelected();
              }
            }}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            aria-label="Seleccionar todos"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="size-4 rounded border"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            aria-label={`Seleccionar ${row.original.id}`}
          />
        ),
        enableSorting: false,
      });
    }

    base.push(
      {
        accessorKey: "id",
        header: "ID",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.id.slice(0, 8)}…
          </span>
        ),
      },
      {
        id: "conductor",
        header: "Conductor",
        accessorFn: (row) => getRecordConductorLabel(row),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Fecha
            <ArrowUpDown className="size-3.5" />
          </Button>
        ),
        cell: ({ row }) => formatDate(row.original.createdAt),
      },
      {
        id: "recorrido",
        header: "Recorrido",
        cell: ({ row }) => {
          const raw = row.original.extraction?.n_recorrido?.valor;
          const display = raw?.trim() || "—";
          const key = raw?.trim().toLowerCase() ?? "";
          const isDupe = key && duplicateRecorridos.has(key);
          return (
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5",
                isDupe && "animate-recorrido-blink ring-2 ring-red-500"
              )}
              title={isDupe ? "Recorrido duplicado en esta lista" : undefined}
            >
              {display}
            </span>
          );
        },
      },
      {
        id: "fecha_recorrido",
        header: "Fecha recorrido",
        cell: ({ row }) => {
          const raw = row.original.extraction?.fecha?.valor;
          if (!raw?.trim()) return "—";
          return formatExtractedDateChilean(raw);
        },
      },
      {
        id: "patente",
        header: "Patente",
        cell: ({ row }) => row.original.extraction?.patente?.valor || "—",
      },
      {
        id: "bitacora",
        header: "Bitácora",
        cell: ({ row }) => {
          const score = matchScoreForRecord(row.original, activeBitacora);
          if (!activeBitacora) return "—";
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
                score >= 60
                  ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
                  : score >= 40
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                    : "bg-muted text-muted-foreground"
              )}
              title={
                score >= 40
                  ? `Coincidencia con bitácora: ${score}%`
                  : "Sin coincidencia clara con bitácora"
              }
            >
              <BookOpen className="size-3" />
              {score >= 40 ? `${score}%` : "—"}
            </span>
          );
        },
      },
      {
        id: "images",
        header: "Imgs.",
        cell: ({ row }) => row.original.images.length,
      },
      {
        accessorKey: "status",
        header: "Estado",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "Acciones",
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Link
              href={`/admin/records/${row.original.id}`}
              className="inline-flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[0.8rem] hover:bg-muted"
            >
              <Eye className="size-4" />
              Revisar
            </Link>
            <PdfExportButton record={row.original} size="sm" />
          </div>
        ),
      }
    );

    return base;
  }, [enableBulkExcel, duplicateRecorridos, activeBitacora]);

  const table = useReactTable({
    data: records,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    enableRowSelection: enableBulkExcel,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Cargando registros…
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <div className="space-y-3">
        {records.map((record) => (
          <RecordSummaryCard
            key={record.id}
            record={record}
            href={`/admin/records/${record.id}`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {enableBulkExcel && isDesktop && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={selectedRecords.length === 0}
            onClick={() => setBulkOpen(true)}
          >
            <FileSpreadsheet className="size-4" />
            Excel unificado
            {selectedRecords.length > 0 && ` (${selectedRecords.length})`}
          </Button>
          <BulkExcelExportDialog
            open={bulkOpen}
            onOpenChange={setBulkOpen}
            records={selectedRecords.length > 0 ? selectedRecords : records}
          />
        </div>
      )}

      <div className="rounded-lg border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center">
                No hay registros en esta categoría.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
    </div>
  );
}
