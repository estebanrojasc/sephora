"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Camera, Images } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { StatusBadge } from "@/components/common/StatusBadge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SkeletonCard } from "@/components/common/Skeleton";
import { useRecord } from "@/features/records/queries";
import { useSessionStore } from "@/features/auth/session-store";
import { canAppendImagesToRecord } from "@/features/records/types";
import { formatDate } from "@/lib/format";
import { formatExtractedDateChilean } from "@/lib/date-utils";

export default function DriverRecordDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const router = useRouter();
  const deviceId = useSessionStore((s) => s.deviceId);
  const { data: record, isLoading, error } = useRecord(id);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <SkeletonCard />
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="space-y-4 p-4">
        <Link
          href="/driver"
          className="inline-flex h-8 w-fit items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          Volver
        </Link>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Envío no encontrado"}
        </p>
      </div>
    );
  }

  if (deviceId && record.deviceId !== deviceId) {
    return (
      <div className="space-y-4 p-4">
        <Link
          href="/driver"
          className="inline-flex h-8 w-fit items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          Volver
        </Link>
        <p className="text-sm text-destructive">
          Este envío no pertenece a este dispositivo.
        </p>
      </div>
    );
  }

  const canAppend = canAppendImagesToRecord(record.status);
  const fecha = record.extraction?.fecha?.valor
    ? formatExtractedDateChilean(record.extraction.fecha.valor)
    : undefined;
  const recorrido = record.extraction?.n_recorrido?.valor;

  return (
    <div className="animate-fade-in space-y-4 p-4">
      <Link
        href="/driver"
        className="inline-flex h-8 w-fit items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium hover:bg-muted"
      >
        <ArrowLeft className="size-4" />
        Volver
      </Link>

      <PageHeader
        title={recorrido ? `Recorrido ${recorrido}` : "Detalle del envío"}
        description={
          fecha
            ? `Fecha documento: ${fecha} · Enviado ${formatDate(record.createdAt)}`
            : `Enviado ${formatDate(record.createdAt)}`
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={record.status} />
        <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          <Images className="size-3" />
          {record.images.length} imagen
          {record.images.length === 1 ? "" : "es"}
        </span>
      </div>

      {record.errorComment && (
        <Alert variant="destructive">
          <AlertDescription>{record.errorComment}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {record.images.map((img, i) => (
          <div
            key={img.id}
            className="overflow-hidden rounded-lg border bg-muted/20"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={`Hoja ${i + 1}`}
              className="aspect-[3/4] w-full object-cover"
            />
          </div>
        ))}
      </div>

      {canAppend ? (
        <Button
          size="lg"
          className="h-12 w-full gap-2"
          onClick={() => router.push(`/driver/capture?recordId=${record.id}`)}
        >
          <Camera className="size-5" />
          Agregar otra imagen
        </Button>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Este envío ya está en revisión o cerrado; no se pueden agregar más
          fotos desde aquí.
        </p>
      )}
    </div>
  );
}
