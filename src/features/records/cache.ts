import type { QueryClient } from "@tanstack/react-query";
import type { Record } from "./types";
import { recordKeys } from "./queries";

/** Actualiza un registro en todas las listas cacheadas sin esperar refetch. */
export function patchRecordInListCaches(
  qc: QueryClient,
  recordId: string,
  patch: Partial<Record>
): void {
  qc.setQueriesData<Record[]>({ queryKey: recordKeys.all }, (old) => {
    if (!Array.isArray(old)) return old;
    const index = old.findIndex((r) => r.id === recordId);
    if (index === -1) return old;
    const next = old.slice();
    next[index] = { ...next[index], ...patch };
    return next;
  });
}
