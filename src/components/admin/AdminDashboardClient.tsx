"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { RecordsQueueToolbar } from "@/components/admin/RecordsQueueToolbar";
import { RecordsTable } from "@/components/admin/RecordsTable";
import { SkeletonTable } from "@/components/common/Skeleton";
import { useRecords } from "@/features/records/queries";
import { useActiveBitacora } from "@/features/bitacora/queries";
import { filterRecordsByDay } from "@/features/records/filter-by-day";
import type { RecordStatus } from "@/features/records/types";
import {
  notifyAdminSessionPrefsChanged,
  useAdminSessionPrefs,
} from "@/hooks/use-admin-session-prefs";
import {
  writeStoredAdminDay,
  writeStoredAdminDayMode,
  writeStoredAdminTab,
} from "@/lib/admin-session-storage";
import { COPY } from "@/lib/constants";

export function AdminDashboardClient() {
  const {
    tab: statusFilter,
    day: dayFilter,
    mode: dayMode,
  } = useAdminSessionPrefs();

  const { data: allRecords = [], isLoading, isError, error, refetch } = useRecords({ status: "all" });
  const { data: activeBitacora } = useActiveBitacora(dayFilter);
  const dayRecords = useMemo(
    () => filterRecordsByDay(allRecords, dayFilter, dayMode),
    [allRecords, dayFilter, dayMode]
  );
  const tabCounts = useMemo(() => {
    const counts: Partial<Record<RecordStatus | "all", number>> = { all: dayRecords.length };
    for (const r of dayRecords) counts[r.status] = (counts[r.status] ?? 0) + 1;
    return counts;
  }, [dayRecords]);
  const filteredRecords = useMemo(
    () =>
      statusFilter === "all"
        ? dayRecords
        : dayRecords.filter((r) => r.status === statusFilter),
    [dayRecords, statusFilter]
  );
  const showTableLoading = isLoading && allRecords.length === 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title={COPY.admin.title}
        description="Seleccione el día y el estado para revisar envíos."
      />

      {isLoading && allRecords.length === 0 ? (
        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className="h-36 skeleton border-b" />
            <div className="h-20 skeleton" />
          </div>
          <SkeletonTable rows={6} cols={7} />
        </div>
      ) : (
        <>
          <RecordsQueueToolbar
            date={dayFilter}
            onDateChange={(d) => {
              writeStoredAdminDay(d);
              notifyAdminSessionPrefsChanged();
            }}
            mode={dayMode}
            onModeChange={(m) => {
              writeStoredAdminDayMode(m);
              notifyAdminSessionPrefsChanged();
            }}
            dayTotalCount={dayRecords.length}
            statusFilter={statusFilter}
            onStatusFilterChange={(v) => {
              writeStoredAdminTab(v);
              notifyAdminSessionPrefsChanged();
            }}
            tabCounts={tabCounts}
          />

          {isError && (
            <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                  <AlertTriangle className="size-4" />
                </div>
                <div>
                  <p className="font-semibold text-destructive">
                    No se pudieron cargar los registros
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {error instanceof Error ? error.message : "Error desconocido"}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs font-medium text-destructive underline underline-offset-4 hover:text-destructive/80"
                    onClick={() => void refetch()}
                  >
                    Reintentar
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Mostrando {filteredRecords.length} de {dayRecords.length} envíos del día
            </p>
            <RecordsTable
              records={filteredRecords}
              isLoading={showTableLoading}
              enableBulkExcel={
                statusFilter === "saved" ||
                statusFilter === "in_review" ||
                statusFilter === "all"
              }
              activeBitacora={activeBitacora}
            />
          </div>
        </>
      )}
    </div>
  );
}
