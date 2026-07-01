"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchRecord, fetchRecords } from "./api";
import type { RecordStatus } from "./types";

const RECORDS_LIST_REFETCH_INTERVAL_MS = 45_000;
const DRIVER_LIST_REFETCH_INTERVAL_MS = 30_000;

export const recordKeys = {
  all: ["records"] as const,
  list: (status?: RecordStatus | "all", deviceId?: string) =>
    [...recordKeys.all, "list", status, deviceId] as const,
  detail: (id: string) => [...recordKeys.all, "detail", id] as const,
};

export function useRecords(params?: {
  status?: RecordStatus | "all";
  deviceId?: string;
  /** Si true, no consulta hasta tener deviceId (flujo conductor). */
  requireDeviceId?: boolean;
  /** Polling más frecuente (conductor). Por defecto: admin 45s. */
  driverPolling?: boolean;
  /** Desactiva refetchInterval (p. ej. bitácora en detalle de registro). */
  poll?: boolean;
}) {
  const pollEnabled = params?.poll !== false;
  return useQuery({
    queryKey: recordKeys.list(params?.status, params?.deviceId),
    queryFn: () => fetchRecords(params),
    enabled: params?.requireDeviceId ? Boolean(params.deviceId) : true,
    staleTime: params?.requireDeviceId ? 15_000 : 30_000,
    placeholderData: keepPreviousData,
    refetchOnMount: true,
    refetchIntervalInBackground: false,
    refetchInterval: !pollEnabled
      ? false
      : params?.driverPolling
        ? DRIVER_LIST_REFETCH_INTERVAL_MS
        : RECORDS_LIST_REFETCH_INTERVAL_MS,
  });
}

export function useRecord(id: string) {
  return useQuery({
    queryKey: recordKeys.detail(id),
    queryFn: () => fetchRecord(id),
    enabled: !!id,
    staleTime: 60_000,
  });
}
