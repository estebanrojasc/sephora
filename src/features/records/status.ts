import type { RecordStatus } from "./types";
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  Upload,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export const RECORD_STATUS = {
  uploaded: {
    label: "Cargado por el conductor",
    tone: "info" as const,
    color: "blue",
    icon: Upload,
  },
  in_review: {
    label: "En revisión",
    tone: "warning" as const,
    color: "amber",
    icon: Eye,
  },
  errors: {
    label: "En espera con errores",
    tone: "danger" as const,
    color: "red",
    icon: AlertCircle,
  },
  saved: {
    label: "Guardado",
    tone: "success" as const,
    color: "green",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rechazado",
    tone: "neutral" as const,
    color: "gray",
    icon: XCircle,
  },
} satisfies Record<
  RecordStatus,
  { label: string; tone: string; color: string; icon: LucideIcon }
>;

export const STATUS_TABS: { value: RecordStatus | "all"; label: string }[] = [
  { value: "uploaded", label: RECORD_STATUS.uploaded.label },
  { value: "in_review", label: RECORD_STATUS.in_review.label },
  { value: "errors", label: RECORD_STATUS.errors.label },
  { value: "saved", label: RECORD_STATUS.saved.label },
  { value: "rejected", label: RECORD_STATUS.rejected.label },
  { value: "all", label: "Todos" },
];

export const OPEN_STATUSES: RecordStatus[] = ["uploaded", "errors"];

export function getStatusConfig(status: RecordStatus) {
  return RECORD_STATUS[status];
}
