"use client";

import { useState } from "react";
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

export function AdminDashboardClient() {
  const [statusFilter, setStatusFilter] = useState<RecordStatus | "all">(
    "uploaded"
  );
  const [dayFilter, setDayFilter] = useState(() => todayIsoDateChile());
  const [dayMode, setDayMode] = useState<RecordsDayFilterMode>("created");

  const { data: records, isLoading } = useRecords({ status: statusFilter });
  const { data: activeBitacora } = useActiveBitacora(dayFilter);

  const filteredRecords = filterRecordsByDay(
    records ?? [],
    dayFilter,
    dayMode
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={COPY.admin.title}
        description="Revise los envíos de los conductores. Los registros en cola aparecen primero."
      />

      <RecordsTabs value={statusFilter} onChange={setStatusFilter} />

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
