"use client";

import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { RecordSummaryCard } from "@/components/common/RecordSummaryCard";
import { EmptyState } from "@/components/common/EmptyState";
import { SkeletonCard } from "@/components/common/Skeleton";
import { useRecords } from "@/features/records/queries";
import { useSessionStore } from "@/features/auth/session-store";
import { COPY } from "@/lib/constants";

export default function DriverHomePage() {
  const deviceId = useSessionStore((s) => s.deviceId);
  const { data: records, isLoading } = useRecords({
    deviceId: deviceId ?? undefined,
    requireDeviceId: true,
    driverPolling: true,
  });

  return (
    <div className="animate-fade-in space-y-4 p-4">
      <PageHeader
        title={COPY.driver.title}
        description="Consulta el estado de tus envíos."
      />

      {isLoading && (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!isLoading && records?.length === 0 && (
        <EmptyState
          icon={Inbox}
          title="Sin envíos"
          description={COPY.driver.empty}
        />
      )}

      <div className="space-y-3">
        {records?.map((record, i) => (
          <div
            key={record.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${i * 0.06}s` }}
          >
            <RecordSummaryCard
              record={record}
              href={`/driver/${record.id}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
