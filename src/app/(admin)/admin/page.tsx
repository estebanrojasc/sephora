"use client";

import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { RecordsTabs } from "@/components/admin/RecordsTabs";
import { RecordsTable } from "@/components/admin/RecordsTable";
import { useRecords } from "@/features/records/queries";
import type { RecordStatus } from "@/features/records/types";
import { COPY } from "@/lib/constants";

export default function AdminPage() {
  const [statusFilter, setStatusFilter] = useState<RecordStatus | "all">(
    "uploaded"
  );
  const { data: records, isLoading } = useRecords({ status: statusFilter });

  return (
    <div className="space-y-6">
      <PageHeader
        title={COPY.admin.title}
        description="Revise los envíos de los conductores. Los registros en cola aparecen primero."
      />

      <RecordsTabs value={statusFilter} onChange={setStatusFilter} />

      <RecordsTable records={records ?? []} isLoading={isLoading} />
    </div>
  );
}
