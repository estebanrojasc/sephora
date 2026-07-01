"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createBitacoraApi,
  createRecordFromBitacoraApi,
  fetchBitacoraById,
  fetchBitacoraDates,
  fetchBitacoras,
  parseBitacoraApi,
  updateBitacoraRowSettingsApi,
} from "./api";
import type { CreateBitacoraPayload } from "./types";

const LIST_KEY = ["bitacora"] as const;

export function useBitacoraDates() {
  return useQuery({
    queryKey: [...LIST_KEY, "dates"],
    queryFn: fetchBitacoraDates,
    staleTime: 0,
    gcTime: 60_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

export function useBitacoras(params?: { date?: string; activeOnly?: boolean }) {
  return useQuery({
    queryKey: [...LIST_KEY, params?.date ?? "all", params?.activeOnly ?? false],
    queryFn: () => fetchBitacoras(params),
  });
}

export function useActiveBitacora(date: string | undefined) {
  return useQuery({
    queryKey: [...LIST_KEY, "active", date],
    queryFn: () => fetchBitacoras({ date: date!, activeOnly: true }),
    enabled: Boolean(date),
    select: (data) => data[0] ?? null,
  });
}

export function useBitacoraVersions(date: string | undefined) {
  return useQuery({
    queryKey: [...LIST_KEY, "versions", date],
    queryFn: () => fetchBitacoras({ date: date! }),
    enabled: Boolean(date),
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useBitacoraById(id: string | undefined) {
  return useQuery({
    queryKey: [...LIST_KEY, "id", id],
    queryFn: () => fetchBitacoraById(id!),
    enabled: Boolean(id),
  });
}

export function useCreateBitacora() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBitacoraPayload) => createBitacoraApi(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}

export function useParseBitacora() {
  return useMutation({
    mutationFn: ({
      rawPaste,
      useAi,
    }: {
      rawPaste: string;
      useAi?: boolean;
    }) => parseBitacoraApi(rawPaste, { useAi }),
  });
}

export function useCreateRecordFromBitacora() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { bitacoraId: string; rowId: string }) =>
      createRecordFromBitacoraApi(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
      void qc.invalidateQueries({ queryKey: ["records"] });
    },
  });
}

export function useUpdateBitacoraRowSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      bitacoraId: string;
      rowId: string;
      allowsMultipleReviews: boolean;
    }) =>
      updateBitacoraRowSettingsApi(payload.bitacoraId, {
        rowId: payload.rowId,
        allowsMultipleReviews: payload.allowsMultipleReviews,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: LIST_KEY });
    },
  });
}
