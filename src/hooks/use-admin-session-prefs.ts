"use client";

import { useSyncExternalStore } from "react";
import type { RecordsDayFilterMode } from "@/components/admin/RecordsDayFilter";
import type { RecordStatus } from "@/features/records/types";
import {
  readStoredAdminDay,
  readStoredAdminDayMode,
  readStoredAdminTab,
} from "@/lib/admin-session-storage";

export type AdminSessionPrefs = {
  tab: RecordStatus | "all";
  day: string;
  mode: RecordsDayFilterMode;
};

const listeners = new Set<() => void>();

const SERVER_SNAPSHOT: AdminSessionPrefs = {
  tab: "uploaded",
  day: "",
  mode: "created",
};

let cachedClientSnapshot: AdminSessionPrefs | null = null;

function readPrefs(): AdminSessionPrefs {
  return {
    tab: readStoredAdminTab(),
    day: readStoredAdminDay(),
    mode: readStoredAdminDayMode(),
  };
}

function getSnapshot(): AdminSessionPrefs {
  const next = readPrefs();
  if (
    cachedClientSnapshot &&
    cachedClientSnapshot.tab === next.tab &&
    cachedClientSnapshot.day === next.day &&
    cachedClientSnapshot.mode === next.mode
  ) {
    return cachedClientSnapshot;
  }
  cachedClientSnapshot = next;
  return cachedClientSnapshot;
}

function getServerSnapshot(): AdminSessionPrefs {
  return SERVER_SNAPSHOT;
}

/** Notifica a useAdminSessionPrefs tras escribir en sessionStorage. */
export function notifyAdminSessionPrefsChanged() {
  cachedClientSnapshot = null;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Preferencias de la cola admin (sessionStorage) sin setState en useEffect. */
export function useAdminSessionPrefs(): AdminSessionPrefs {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
