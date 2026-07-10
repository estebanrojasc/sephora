import type { RecordsDayFilterMode } from "@/components/admin/RecordsDayFilter";
import type { RecordStatus } from "@/features/records/types";
import { todayIsoDateChile } from "@/lib/date-utils";

export const ADMIN_TAB_STORAGE_KEY = "admin-records-tab";
export const ADMIN_DAY_STORAGE_KEY = "admin-records-day";
export const ADMIN_DAY_MODE_STORAGE_KEY = "admin-records-day-mode";
export const ADMIN_BITACORA_DATE_STORAGE_KEY = "admin-bitacora-last-date";

const ALLOWED_TABS: (RecordStatus | "all")[] = [
  "uploaded",
  "in_review",
  "errors",
  "saved",
  "rejected",
  "all",
];

export function readStoredAdminTab(): RecordStatus | "all" {
  if (typeof window === "undefined") return "uploaded";
  const stored = sessionStorage.getItem(ADMIN_TAB_STORAGE_KEY);
  return ALLOWED_TABS.includes(stored as RecordStatus | "all")
    ? (stored as RecordStatus | "all")
    : "uploaded";
}

export function writeStoredAdminTab(value: RecordStatus | "all") {
  sessionStorage.setItem(ADMIN_TAB_STORAGE_KEY, value);
}

export function readStoredAdminDay(): string {
  if (typeof window === "undefined") return todayIsoDateChile();
  const stored = sessionStorage.getItem(ADMIN_DAY_STORAGE_KEY);
  return stored?.match(/^\d{4}-\d{2}-\d{2}$/) ? stored : todayIsoDateChile();
}

export function writeStoredAdminDay(date: string) {
  sessionStorage.setItem(ADMIN_DAY_STORAGE_KEY, date);
}

export function readStoredAdminDayMode(): RecordsDayFilterMode {
  if (typeof window === "undefined") return "created";
  const stored = sessionStorage.getItem(ADMIN_DAY_MODE_STORAGE_KEY);
  return stored === "fecha" ? "fecha" : "created";
}

export function writeStoredAdminDayMode(mode: RecordsDayFilterMode) {
  sessionStorage.setItem(ADMIN_DAY_MODE_STORAGE_KEY, mode);
}

export function writeStoredBitacoraDate(date: string) {
  if (date.match(/^\d{4}-\d{2}-\d{2}$/)) {
    sessionStorage.setItem(ADMIN_BITACORA_DATE_STORAGE_KEY, date);
  }
}

/**
 * Alinea la cola admin para ver un registro creado desde bitácora:
 * pestaña Guardados + día por fecha de recorrido (no por carga).
 */
export function focusAdminQueueOnBitacoraRecord(dayIso: string) {
  if (!dayIso.match(/^\d{4}-\d{2}-\d{2}$/)) return;
  writeStoredAdminTab("saved");
  writeStoredAdminDay(dayIso);
  writeStoredAdminDayMode("fecha");
  writeStoredBitacoraDate(dayIso);
}

/** URL de la cola admin ya filtrada al día de la bitácora (fecha de recorrido). */
export function adminQueueUrlForBitacoraDay(dayIso: string): string {
  const qs = new URLSearchParams({
    day: dayIso,
    mode: "fecha",
    tab: "saved",
  });
  return `/admin?${qs.toString()}`;
}

export function readStoredBitacoraDate(): string | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(ADMIN_BITACORA_DATE_STORAGE_KEY);
  return stored?.match(/^\d{4}-\d{2}-\d{2}$/) ? stored : null;
}
