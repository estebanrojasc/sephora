import type { Record as AppRecord } from "./types";
import { recordDayKeyIso } from "@/lib/date-utils";
import type { RecordsDayFilterMode } from "@/components/admin/RecordsDayFilter";

export function filterRecordsByDay(
  records: AppRecord[],
  dayIso: string,
  mode: RecordsDayFilterMode
): AppRecord[] {
  return records.filter(
    (r) =>
      recordDayKeyIso(r.createdAt, r.extraction?.fecha?.valor, mode) === dayIso
  );
}

export function duplicateRecorridoKeys(records: AppRecord[]): Set<string> {
  const counts = new Map<string, number>();
  for (const r of records) {
    const key = r.extraction?.n_recorrido?.valor?.trim().toLowerCase();
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const dupes = new Set<string>();
  for (const [key, count] of counts) {
    if (count > 1) dupes.add(key);
  }
  return dupes;
}
