"use client";

import { useEffect, useState } from "react";
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
import { todayIsoDateChile } from "@/lib/date-utils";
import { COPY } from "@/lib/constants";

const ADMIN_TAB_STORAGE_KEY = "admin-records-tab";

function readStoredTab(): RecordStatus | "all" {
  if (typeof window === "undefined") return "uploaded";
  const stored = sessionStorage.getItem(ADMIN_TAB_STORAGE_KEY);
  const allowed: (RecordStatus | "all")[] = [
    "uploaded",
    "in_review",
    "errors",
    "saved",
    "rejected",
    "all",
  ];
  return allowed.includes(stored as RecordStatus | "all")
    ? (stored as RecordStatus | "all")
    : "uploaded";
}

export function AdminDashboardClient() {
  const [statusFilter, setStatusFilter] = useState<RecordStatus | "all">(
    "uploaded"
  );
  const [tabReady, setTabReady] = useState(false);
  const [dayFilter, setDayFilter] = useState(() => todayIsoDateChile());
  const [dayMode, setDayMode] = useState<RecordsDayFilterMode>("created");

  useEffect(() => {
    setStatusFilter(readStoredTab());
    setTabReady(true);
  }, []);

  function handleTabChange(value: RecordStatus | "all") {
    setStatusFilter(value);
    sessionStorage.setItem(ADMIN_TAB_STORAGE_KEY, value);
  }

  const {
    data: records,
    isLoading,
    isError,
    error,
    refetch,
  } = useRecords({ status: statusFilter });
  const { data: activeBitacora } = useActiveBitacora(dayFilter);

  const filteredRecords = filterRecordsByDay(
    records ?? [],
    dayFilter,
    dayMode
  );

  if (!tabReady) {
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

      <RecordsTabs value={statusFilter} onChange={handleTabChange} />

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
        onDateChange={setDayFilter}
        mode={dayMode}
        onModeChange={setDayMode}
        recordCount={filteredRecords.length}
      />

      <RecordsTable
        records={filteredRecords}
        isLoading={isLoading}
        enableBulkExcel={statusFilter === "saved"}
        activeBitacora={activeBitacora}
      />
    </div>
  );
}
