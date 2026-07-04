"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { motion } from "motion/react";
import { PageHeader } from "@/components/common/PageHeader";
import { RecordsTabs } from "@/components/admin/RecordsTabs";
import { RecordsTable } from "@/components/admin/RecordsTable";
import { RecordsDayFilter, type RecordsDayFilterMode } from "@/components/admin/RecordsDayFilter";
import { SkeletonTable } from "@/components/common/Skeleton";
import { Card } from "@/components/ui/card";
import { useRecords } from "@/features/records/queries";
import { useActiveBitacora } from "@/features/bitacora/queries";
import { filterRecordsByDay } from "@/features/records/filter-by-day";
import type { RecordStatus } from "@/features/records/types";
import {
  readStoredAdminDay, readStoredAdminDayMode, readStoredAdminTab,
  writeStoredAdminDay, writeStoredAdminDayMode, writeStoredAdminTab,
} from "@/lib/admin-session-storage";
import { COPY } from "@/lib/constants";
import { cn } from "@/lib/utils";

const KPI_CARDS = [
  { key: "uploaded" as const, label: "Pendientes", icon: Clock, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/50" },
  { key: "in_review" as const, label: "En revisión", icon: TrendingUp, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/50" },
  { key: "saved" as const, label: "Guardados", icon: CheckCircle2, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/50" },
  { key: "errors" as const, label: "Con errores", icon: AlertTriangle, color: "text-red-600 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/50" },
] as const;

export function AdminDashboardClient() {
  const [statusFilter, setStatusFilter] = useState<RecordStatus | "all">("uploaded");
  const [filtersReady, setFiltersReady] = useState(false);
  const [dayFilter, setDayFilter] = useState(() => readStoredAdminDay());
  const [dayMode, setDayMode] = useState<RecordsDayFilterMode>(() => readStoredAdminDayMode());

  useEffect(() => {
    setStatusFilter(readStoredAdminTab());
    setDayFilter(readStoredAdminDay());
    setDayMode(readStoredAdminDayMode());
    setFiltersReady(true);
  }, []);

  const { data: allRecords = [], isLoading, isError, error, refetch } = useRecords({ status: "all" });
  const { data: activeBitacora } = useActiveBitacora(dayFilter);
  const dayRecords = useMemo(() => filterRecordsByDay(allRecords, dayFilter, dayMode), [allRecords, dayFilter, dayMode]);
  const tabCounts = useMemo(() => {
    const counts: Partial<Record<RecordStatus | "all", number>> = { all: dayRecords.length };
    for (const r of dayRecords) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return counts;
  }, [dayRecords]);
  const filteredRecords = useMemo(() => statusFilter === "all" ? dayRecords : dayRecords.filter(r => r.status === statusFilter), [dayRecords, statusFilter]);
  const showTableLoading = isLoading && allRecords.length === 0;

  if (!filtersReady) return (
    <div className="flex h-40 items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="size-2 animate-pulse-soft rounded-full bg-primary/60" />Cargando panel…
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title={COPY.admin.title} description="Revise los envíos de los conductores." />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {KPI_CARDS.map(({ key, label, icon: Icon, color, bg }, i) => (
          <motion.div
            key={key}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.35 }}
          >
            <Card className="glass hover-lift p-4 transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className={cn("flex size-10 items-center justify-center rounded-xl", bg)}>
                  <Icon className={cn("size-5", color)} />
                </div>
                <span className="text-2xl font-extrabold tabular-nums tracking-tight">
                  {tabCounts[key] ?? 0}
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-muted-foreground">{label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {isLoading && allRecords.length === 0 ? (
        <div className="space-y-4">
          <div className="flex gap-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-9 w-24 skeleton rounded-full" />)}</div>
          <SkeletonTable rows={6} cols={7} />
        </div>
      ) : (
        <>
          <RecordsTabs value={statusFilter} onChange={(v) => { setStatusFilter(v); writeStoredAdminTab(v); }} counts={tabCounts} />

          {isError && (
            <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-4" />
                </div>
                <div>
                  <p className="font-semibold text-destructive">No se pudieron cargar los registros</p>
                  <p className="mt-1 text-xs text-muted-foreground">{error instanceof Error ? error.message : "Error desconocido"}</p>
                  <button type="button" className="mt-2 text-xs font-medium text-destructive underline underline-offset-4 hover:text-destructive/80" onClick={() => void refetch()}>Reintentar</button>
                </div>
              </div>
            </div>
          )}

          <RecordsDayFilter date={dayFilter} onDateChange={(d) => { setDayFilter(d); writeStoredAdminDay(d); }} mode={dayMode} onModeChange={(m) => { setDayMode(m); writeStoredAdminDayMode(m); }} recordCount={filteredRecords.length} />

          <RecordsTable records={filteredRecords} isLoading={showTableLoading} enableBulkExcel={statusFilter === "saved"} activeBitacora={activeBitacora} />
        </>
      )}
    </div>
  );
}