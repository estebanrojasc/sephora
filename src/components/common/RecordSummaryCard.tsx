import Link from "next/link";
import { Images, ChevronRight } from "lucide-react";
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
        "group tap-active transition-all duration-200",
        href && "hover-lift cursor-pointer",
        className
      )}
    >
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-xs text-muted-foreground">
            {formatDate(record.createdAt)}
          </p>
          {recorrido && (
            <p className="truncate font-semibold">
              Recorrido {recorrido}
              {fecha && (
                <span className="ml-1 font-normal text-muted-foreground">
                  · {fecha}
                </span>
              )}
            </p>
          )}
          {record.errorComment && (
            <p className="line-clamp-2 text-xs text-destructive">
              {record.errorComment}
            </p>
          )}
          {href && (
            <div className="flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100 sm:opacity-100">
              {record.status === "errors" || record.status === "uploaded"
                ? "Ver / agregar fotos"
                : "Ver envío"}{" "}
              <ChevronRight className="size-3" />
            </div>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2.5">
          <StatusBadge status={record.status} />
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            <Images className="size-3" />
            {record.images.length}
          </span>
        </div>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href} className="block">{content}</Link>;
  }

  return content;
}
