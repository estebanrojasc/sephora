"use client";

import Link from "next/link";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { ArrowUpDown, Eye } from "lucide-react";
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
import type { Record } from "@/features/records/types";
import { getRecordConductorLabel } from "@/features/records/display";
import { formatDate } from "@/lib/format";
import { formatExtractedDateChilean } from "@/lib/date-utils";
import { useIsDesktop } from "@/hooks/use-media-query";

interface RecordsTableProps {
  records: Record[];
  isLoading?: boolean;
}

export function RecordsTable({ records, isLoading }: RecordsTableProps) {
  const isDesktop = useIsDesktop();
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: false },
  ]);

  const columns = useMemo<ColumnDef<Record>[]>(
    () => [
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
        cell: ({ row }) =>
          row.original.extraction?.n_recorrido?.valor || "—",
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
      },
    ],
    []
  );

  const table = useReactTable({
    data: records,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
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
  );
}
