"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { STATUS_TABS, RECORD_STATUS } from "@/features/records/status";
import type { RecordStatus } from "@/features/records/types";
import { cn } from "@/lib/utils";

interface RecordsTabsProps {
  value: RecordStatus | "all";
  onChange: (value: RecordStatus | "all") => void;
  /** Conteos por tab (filtrados por día); solo se muestran si > 0. */
  counts?: Partial<Record<RecordStatus | "all", number>>;
}

function formatTabLabel(label: string, count?: number): string {
  if (count != null && count > 0) return `${label} (${count})`;
  return label;
}

const tabColors: Record<string, string> = {
  uploaded:
    "data-active:bg-blue-50 data-active:text-blue-700 data-active:border-blue-200 dark:data-active:bg-blue-950/60 dark:data-active:text-blue-200",
  in_review:
    "data-active:bg-amber-50 data-active:text-amber-800 data-active:border-amber-200 dark:data-active:bg-amber-950/60 dark:data-active:text-amber-200",
  errors:
    "data-active:bg-red-50 data-active:text-red-700 data-active:border-red-200 dark:data-active:bg-red-950/60 dark:data-active:text-red-200",
  saved:
    "data-active:bg-emerald-50 data-active:text-emerald-700 data-active:border-emerald-200 dark:data-active:bg-emerald-950/60 dark:data-active:text-emerald-200",
  rejected:
    "data-active:bg-slate-100 data-active:text-slate-700 data-active:border-slate-300 dark:data-active:bg-slate-800 dark:data-active:text-slate-200",
  all: "data-active:bg-indigo-50 data-active:text-indigo-700 data-active:border-indigo-200 dark:data-active:bg-indigo-950/60 dark:data-active:text-indigo-200",
};

export function RecordsTabs({ value, onChange, counts }: RecordsTabsProps) {
  return (
    <Tabs
      value={value}
      onValueChange={(v) => onChange(v as RecordStatus | "all")}
      className="w-full"
    >
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1.5 bg-transparent p-0">
        {STATUS_TABS.map((tab) => {
          const status =
            tab.value === "all" ? null : RECORD_STATUS[tab.value as RecordStatus];
          const Icon = status?.icon;
          return (
            <TabsTrigger
              key={tab.value}
              value={tab.value}
              className={cn(
                "h-8 rounded-full border border-transparent bg-muted/60 px-3.5 text-xs font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground sm:text-sm",
                tabColors[tab.value]
              )}
            >
              {Icon && <Icon className="size-3.5" />}
              {formatTabLabel(tab.label, counts?.[tab.value])}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}
