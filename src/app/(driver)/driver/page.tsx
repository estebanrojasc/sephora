"use client";

import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { RecordSummaryCard } from "@/components/common/RecordSummaryCard";
import { EmptyState } from "@/components/common/EmptyState";
import { CaptureFab } from "@/components/driver/CaptureFab";
import { useRecords } from "@/features/records/queries";
import { useSessionStore } from "@/features/auth/session-store";
import { COPY } from "@/lib/constants";

export default function DriverHomePage() {
  const deviceId = useSessionStore((s) => s.deviceId);
  const { data: records, isLoading } = useRecords({
    deviceId: deviceId ?? undefined,
    requireDeviceId: true,
  });

  return (
    <>
      <div className="space-y-4 p-4">
        <PageHeader
          title={COPY.driver.title}
          description="Consulta el estado de tus envíos. No puedes editar registros desde aquí."
        />

        {isLoading && (
          <p className="text-center text-sm text-muted-foreground">
            Cargando historial…
          </p>
        )}

        {!isLoading && records?.length === 0 && (
          <EmptyState
            icon={Inbox}
            title="Sin envíos"
            description={COPY.driver.empty}
          />
        )}

        <div className="space-y-3">
          {records?.map((record) => (
            <RecordSummaryCard key={record.id} record={record} />
          ))}
        </div>
      </div>
      <CaptureFab />
    </>
  );
}
