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
    "data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 data-[state=active]:border-blue-200 data-[state=active]:shadow-sm dark:data-[state=active]:bg-blue-950/60 dark:data-[state=active]:text-blue-200 dark:data-[state=active]:border-blue-800",
  in_review:
    "data-[state=active]:bg-amber-50 data-[state=active]:text-amber-800 data-[state=active]:border-amber-200 data-[state=active]:shadow-sm dark:data-[state=active]:bg-amber-950/60 dark:data-[state=active]:text-amber-200 dark:data-[state=active]:border-amber-800",
  errors:
    "data-[state=active]:bg-red-50 data-[state=active]:text-red-700 data-[state=active]:border-red-200 data-[state=active]:shadow-sm dark:data-[state=active]:bg-red-950/60 dark:data-[state=active]:text-red-200 dark:data-[state=active]:border-red-800",
  saved:
    "data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700 data-[state=active]:border-emerald-200 data-[state=active]:shadow-sm dark:data-[state=active]:bg-emerald-950/60 dark:data-[state=active]:text-emerald-200 dark:data-[state=active]:border-emerald-800",
  rejected:
    "data-[state=active]:bg-slate-100 data-[state=active]:text-slate-700 data-[state=active]:border-slate-300 data-[state=active]:shadow-sm dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-slate-200 dark:data-[state=active]:border-slate-600",
  all: "data-[state=active]:bg-indigo-50 data-[state=active]:text-indigo-700 data-[state=active]:border-indigo-200 data-[state=active]:shadow-sm dark:data-[state=active]:bg-indigo-950/60 dark:data-[state=active]:text-indigo-200 dark:data-[state=active]:border-indigo-800",
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
                "h-9 rounded-full border border-transparent bg-muted/50 px-3.5 text-xs font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground data-[state=active]:border sm:text-sm",
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
