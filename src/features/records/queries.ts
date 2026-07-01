"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchRecord, fetchRecords } from "./api";
import type { RecordStatus } from "./types";

const RECORDS_LIST_REFETCH_INTERVAL_MS = 15_000;

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
}) {
  return useQuery({
    queryKey: recordKeys.list(params?.status, params?.deviceId),
    queryFn: () => fetchRecords(params),
    enabled: params?.requireDeviceId ? Boolean(params.deviceId) : true,
    staleTime: 0,
    refetchOnMount: "always",
    // Los envíos pueden llegar desde otro dispositivo/navegador. Sin polling,
    // el panel de revisión no se entera hasta que alguna mutación local invalida
    // la cache (por ejemplo, "Aplicar IA").
    refetchInterval: RECORDS_LIST_REFETCH_INTERVAL_MS,
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
