"use client";

import { STATUS_TABS, RECORD_STATUS } from "@/features/records/status";
import type { RecordStatus } from "@/features/records/types";
import { cn } from "@/lib/utils";

interface RecordsStatusFilterProps {
  value: RecordStatus | "all";
  onChange: (value: RecordStatus | "all") => void;
  counts?: Partial<Record<RecordStatus | "all", number>>;
}

const TAB_SHORT_LABELS: Record<RecordStatus | "all", string> = {
  uploaded: "Pendientes",
  in_review: "En revisión",
  errors: "Con errores",
  saved: "Guardados",
  rejected: "Rechazados",
  all: "Todos",
};

const tabColors: Record<string, string> = {
  uploaded:
    "border-blue-200/60 bg-blue-50/80 text-blue-800 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-200",
  in_review:
    "border-amber-200/60 bg-amber-50/80 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  errors:
    "border-red-200/60 bg-red-50/80 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200",
  saved:
    "border-emerald-200/60 bg-emerald-50/80 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  rejected:
    "border-slate-300/60 bg-slate-100/80 text-slate-800 dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-200",
  all: "border-primary/30 bg-primary-lighter/80 text-primary-darker dark:border-primary/40 dark:bg-primary-darker/30 dark:text-primary-light",
};

function formatLabel(label: string, count?: number): string {
  if (count != null && count > 0) return `${label} (${count})`;
  return label;
}

/** Filtro de estado sin primitivo Tabs (evita h-8 fijo y solapamientos). */
export function RecordsStatusFilter({
  value,
  onChange,
  counts,
}: RecordsStatusFilterProps) {
  return (
    <div className="overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div
        className="flex w-max min-w-full gap-2 pb-0.5"
        role="tablist"
        aria-label="Estado del registro"
      >
        {STATUS_TABS.map((tab) => {
          const active = value === tab.value;
          const status =
            tab.value === "all" ? null : RECORD_STATUS[tab.value as RecordStatus];
          const Icon = status?.icon;
          const shortLabel = TAB_SHORT_LABELS[tab.value];
          const longLabel = tab.label;

          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              title={longLabel}
              onClick={() => onChange(tab.value)}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors sm:text-sm",
                active
                  ? cn("shadow-sm ring-1 ring-primary/20", tabColors[tab.value])
                  : "border-transparent bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {Icon && <Icon className="size-3.5 shrink-0" />}
              <span className="sm:hidden">
                {formatLabel(shortLabel, counts?.[tab.value])}
              </span>
              <span className="hidden sm:inline">
                {formatLabel(longLabel, counts?.[tab.value])}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
