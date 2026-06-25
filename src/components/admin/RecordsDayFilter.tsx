"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  formatChileanDate,
  todayIsoDateChile,
} from "@/lib/date-utils";

export type RecordsDayFilterMode = "created" | "fecha";

interface RecordsDayFilterProps {
  date: string;
  onDateChange: (date: string) => void;
  mode: RecordsDayFilterMode;
  onModeChange: (mode: RecordsDayFilterMode) => void;
  recordCount: number;
}

export function RecordsDayFilter({
  date,
  onDateChange,
  mode,
  onModeChange,
  recordCount,
}: RecordsDayFilterProps) {
  const isToday = date === todayIsoDateChile();

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <Label htmlFor="records-day-filter" className="text-sm font-medium">
            Día
          </Label>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => onDateChange(todayIsoDateChile())}
          >
            Hoy
          </Button>
        </div>
        <Input
          id="records-day-filter"
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="w-full sm:w-44"
        />
        <p className="text-xs text-muted-foreground">
          {formatChileanDate(date)}
          {isToday && " · hoy"}
          {" · "}
          {recordCount} registro{recordCount === 1 ? "" : "s"}
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "created" ? "default" : "outline"}
          onClick={() => onModeChange("created")}
        >
          Fecha de carga
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "fecha" ? "default" : "outline"}
          onClick={() => onModeChange("fecha")}
        >
          Fecha recorrido
        </Button>
      </div>
    </div>
  );
}
