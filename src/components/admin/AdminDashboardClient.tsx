"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { RecordsTabs } from "@/components/admin/RecordsTabs";
import { RecordsTable } from "@/components/admin/RecordsTable";
import {
  RecordsDayFilter,
  type RecordsDayFilterMode,
} from "@/components/admin/RecordsDayFilter";
import { useRecords } from "@/features/records/queries";
import { useActiveBitacora } from "@/features/bitacora/queries";
import { filterRecordsByDay } from "@/features/records/filter-by-day";
import type { RecordStatus } from "@/features/records/types";
import {
  readStoredAdminDay,
  readStoredAdminDayMode,
  readStoredAdminTab,
  writeStoredAdminDay,
  writeStoredAdminDayMode,
  writeStoredAdminTab,
} from "@/lib/admin-session-storage";
import { COPY } from "@/lib/constants";

export function AdminDashboardClient() {
  const [statusFilter, setStatusFilter] = useState<RecordStatus | "all">(
    "uploaded"
  );
  const [filtersReady, setFiltersReady] = useState(false);
  const [dayFilter, setDayFilter] = useState(() => readStoredAdminDay());
  const [dayMode, setDayMode] = useState<RecordsDayFilterMode>(() =>
    readStoredAdminDayMode()
  );

  useEffect(() => {
    setStatusFilter(readStoredAdminTab());
    setDayFilter(readStoredAdminDay());
    setDayMode(readStoredAdminDayMode());
    setFiltersReady(true);
  }, []);

  function handleTabChange(value: RecordStatus | "all") {
    setStatusFilter(value);
    writeStoredAdminTab(value);
  }

  function handleDayChange(date: string) {
    setDayFilter(date);
    writeStoredAdminDay(date);
  }

  function handleDayModeChange(mode: RecordsDayFilterMode) {
    setDayMode(mode);
    writeStoredAdminDayMode(mode);
  }

  const {
    data: allRecords = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useRecords({ status: "all" });
  const { data: activeBitacora } = useActiveBitacora(dayFilter);

  const dayRecords = useMemo(
    () => filterRecordsByDay(allRecords, dayFilter, dayMode),
    [allRecords, dayFilter, dayMode]
  );

  const tabCounts = useMemo(() => {
    const counts: Partial<Record<RecordStatus | "all", number>> = {
      all: dayRecords.length,
    };
    for (const record of dayRecords) {
      counts[record.status] = (counts[record.status] ?? 0) + 1;
    }
    return counts;
  }, [dayRecords]);

  const filteredRecords = useMemo(() => {
    if (statusFilter === "all") return dayRecords;
    return dayRecords.filter((r) => r.status === statusFilter);
  }, [dayRecords, statusFilter]);

  const showTableLoading = isLoading && allRecords.length === 0;

  if (!filtersReady) {
    return (
      <div className="flex h-40 items-center justify-center text-muted-foreground">
        Cargando panel…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={COPY.admin.title}
        description="Revise los envíos de los conductores. Los registros en cola aparecen primero."
      />

      <RecordsTabs
        value={statusFilter}
        onChange={handleTabChange}
        counts={tabCounts}
      />

      {isError ? (
        <div className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          <p className="font-medium">No se pudieron cargar los registros</p>
          <p className="mt-1 text-xs opacity-90">
            {error instanceof Error ? error.message : "Error desconocido"}
          </p>
          <button
            type="button"
            className="mt-2 text-xs underline"
            onClick={() => void refetch()}
          >
            Reintentar
          </button>
        </div>
      ) : null}

      <RecordsDayFilter
        date={dayFilter}
        onDateChange={handleDayChange}
        mode={dayMode}
        onModeChange={handleDayModeChange}
        recordCount={filteredRecords.length}
      />

      <RecordsTable
        records={filteredRecords}
        isLoading={showTableLoading}
        enableBulkExcel={statusFilter === "saved"}
        activeBitacora={activeBitacora}
      />
    </div>
  );
}
