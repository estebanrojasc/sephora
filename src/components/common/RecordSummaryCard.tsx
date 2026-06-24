import Link from "next/link";
import { Images } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import type { Record } from "@/features/records/types";
import { formatDate } from "@/lib/format";
import { formatExtractedDateChilean } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface RecordSummaryCardProps {
  record: Record;
  href?: string;
  className?: string;
}

export function RecordSummaryCard({
  record,
  href,
  className,
}: RecordSummaryCardProps) {
  const recorrido = record.extraction?.n_recorrido?.valor;
  const fechaRaw = record.extraction?.fecha?.valor;
  const fecha = fechaRaw ? formatExtractedDateChilean(fechaRaw) : undefined;

  const content = (
    <Card
      className={cn(
        "transition-shadow",
        href && "hover:shadow-md cursor-pointer",
        className
      )}
    >
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm text-muted-foreground">
            {formatDate(record.createdAt)}
          </p>
          {recorrido && (
            <p className="truncate font-medium">
              Recorrido {recorrido}
              {fecha && <span className="text-muted-foreground"> · {fecha}</span>}
            </p>
          )}
          {record.errorComment && (
            <p className="line-clamp-2 text-xs text-destructive">
              {record.errorComment}
            </p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StatusBadge status={record.status} />
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Images className="size-3.5" />
            {record.images.length}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
