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
import { SkeletonTable } from "@/components/common/Skeleton";
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
            className="size-4 rounded border accent-primary cursor-pointer"
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
            className="size-4 rounded border accent-primary cursor-pointer"
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
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.id.slice(0, 8)}…
          </span>
        ),
      },
      {
        id: "conductor",
        header: "Conductor",
        accessorFn: (row) => getRecordConductorLabel(row),
        cell: ({ row }) => (
          <span className="font-medium">
            {getRecordConductorLabel(row.original)}
          </span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8 gap-1 font-medium"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            Fecha
            <ArrowUpDown className="size-3 text-muted-foreground" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-sm">{formatDate(row.original.createdAt)}</span>
        ),
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
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium",
                isDupe
                  ? "animate-recorrido-blink ring-2 ring-red-500"
                  : "bg-muted/60"
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
          if (!raw?.trim()) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="text-sm">{formatExtractedDateChilean(raw)}</span>
          );
        },
      },
      {
        id: "patente",
        header: "Patente",
        cell: ({ row }) => (
          <span className="font-mono text-sm">
            {row.original.extraction?.patente?.valor || "—"}
          </span>
        ),
      },
      {
        id: "bitacora",
        header: "Bitácora",
        cell: ({ row }) => {
          const score = matchScoreForRecord(row.original, activeBitacora);
          if (!activeBitacora) return <span className="text-muted-foreground">—</span>;
          return (
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
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
        cell: ({ row }) => (
          <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
            {row.original.images.length}
          </span>
        ),
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
          <div className="flex items-center gap-1.5">
            <Link
              href={`/admin/records/${row.original.id}`}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-transparent bg-primary/10 px-3 text-xs font-medium text-primary transition-all hover:bg-primary/20 hover:border-primary/20"
            >
              <Eye className="size-3.5" />
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
    return <SkeletonTable rows={5} cols={enableBulkExcel ? 8 : 7} />;
  }

  if (!isDesktop) {
    return (
      <div className="animate-fade-in space-y-3">
        {records.map((record, i) => (
          <div
            key={record.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${i * 0.04}s` }}
          >
            <RecordSummaryCard
              record={record}
              href={`/admin/records/${record.id}`}
            />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {enableBulkExcel && isDesktop && (
        <div className="animate-slide-in-right flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={selectedRecords.length === 0}
            onClick={() => setBulkOpen(true)}
            className="gap-2 shadow-sm transition-all hover:shadow-md"
          >
            <FileSpreadsheet className="size-4" />
            Excel unificado
            {selectedRecords.length > 0 && (
              <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-bold text-primary">
                {selectedRecords.length}
              </span>
            )}
          </Button>
          <BulkExcelExportDialog
            open={bulkOpen}
            onOpenChange={setBulkOpen}
            records={selectedRecords.length > 0 ? selectedRecords : records}
            activeBitacora={activeBitacora}
          />
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id} className="bg-muted/30 hover:bg-muted/30">
                {hg.headers.map((header) => (
                  <TableHead key={header.id} className="h-10 text-xs font-semibold text-muted-foreground">
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
                <TableRow
                  key={row.id}
                  className="transition-colors hover:bg-muted/30"
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className="py-2.5">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center"
                >
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <BookOpen className="size-8 opacity-30" />
                    <p className="text-sm">No hay registros en esta categoría.</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
