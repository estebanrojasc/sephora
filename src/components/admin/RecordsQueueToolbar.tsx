"use client";

import { CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RecordsStatusFilter } from "@/components/admin/RecordsStatusFilter";
import type { RecordsDayFilterMode } from "@/components/admin/RecordsDayFilter";
import type { RecordStatus } from "@/features/records/types";
import {
  formatChileanDate,
  todayIsoDateChile,
} from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface RecordsQueueToolbarProps {
  date: string;
  onDateChange: (date: string) => void;
  mode: RecordsDayFilterMode;
  onModeChange: (mode: RecordsDayFilterMode) => void;
  /** Total de envíos del día (sin filtrar por estado). */
  dayTotalCount: number;
  statusFilter: RecordStatus | "all";
  onStatusFilterChange: (value: RecordStatus | "all") => void;
  tabCounts?: Partial<Record<RecordStatus | "all", number>>;
}

/**
 * Barra de trabajo de la cola de revisión.
 * Dos bloques apilados con borde (sin Tabs UI): día → estado.
 */
export function RecordsQueueToolbar({
  date,
  onDateChange,
  mode,
  onModeChange,
  dayTotalCount,
  statusFilter,
  onStatusFilterChange,
  tabCounts,
}: RecordsQueueToolbarProps) {
  const isToday = date === todayIsoDateChile();

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Bloque 1: día operativo */}
      <div className="space-y-3 border-b bg-muted/15 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays className="size-4 text-primary" />
            Día operativo
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0 text-xs"
            onClick={() => onDateChange(todayIsoDateChile())}
          >
            Ir a hoy
          </Button>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            id="records-day-filter"
            type="date"
            aria-label="Día operativo"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="h-10 w-full sm:max-w-[220px]"
          />
          <p className="text-xs text-muted-foreground sm:ml-1">
            {formatChileanDate(date)}
            {isToday && " · hoy"}
            {" · "}
            {dayTotalCount} envío{dayTotalCount === 1 ? "" : "s"}
          </p>
        </div>

        <div
          className="inline-flex rounded-lg border bg-background p-0.5"
          role="group"
          aria-label="Criterio de fecha"
        >
          <button
            type="button"
            onClick={() => onModeChange("created")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
              mode === "created"
                ? "btn-neon shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Fecha de carga
          </button>
          <button
            type="button"
            onClick={() => onModeChange("fecha")}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors sm:text-sm",
              mode === "fecha"
                ? "btn-neon shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Fecha recorrido
          </button>
        </div>
      </div>

      {/* Bloque 2: estado (scroll horizontal, sin altura fija) */}
      <div className="p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Estado
        </p>
        <RecordsStatusFilter
          value={statusFilter}
          onChange={onStatusFilterChange}
          counts={tabCounts}
        />
      </div>
    </div>
  );
}
