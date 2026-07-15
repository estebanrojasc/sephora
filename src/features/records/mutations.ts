"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  openRecord,
  processRecordAI,
  releaseRecord,
  updateRecordExtraction,
  updateRecordStatus,
  uploadRecordImages,
  deleteRecordApi,
  unlinkRecordFromBitacoraApi,
} from "./api";
import { patchRecordInListCaches } from "./cache";
import { recordKeys } from "./queries";
import type {
  ProcessAIPayload,
  Record,
  UpdateExtractionPayload,
  UpdateStatusPayload,
  UploadPayload,
} from "./types";

export function useUploadImages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UploadPayload) => uploadRecordImages(payload),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: recordKeys.all });
      qc.setQueryData(recordKeys.detail(data.id), data);
    },
  });
}

export function useDeleteRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRecordApi(id),
    onSuccess: (_data, id) => {
      void qc.invalidateQueries({ queryKey: recordKeys.all });
      qc.removeQueries({ queryKey: recordKeys.detail(id) });
    },
  });
}

export function useUnlinkRecordFromBitacora() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => unlinkRecordFromBitacoraApi(id),
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: recordKeys.all });
      void qc.invalidateQueries({ queryKey: ["bitacora"] });
      qc.setQueryData(recordKeys.detail(data.id), data);
    },
  });
}

export function useOpenRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => openRecord(id),
    onSuccess: (data) => {
      patchRecordInListCaches(qc, data.id, {
        status: data.status,
        previousStatus: data.previousStatus,
      });
      qc.setQueryData(recordKeys.detail(data.id), (old: Record | undefined) =>
        old
          ? {
              ...old,
              status: data.status,
              previousStatus: data.previousStatus,
            }
          : old
      );
    },
  });
}

export function useReleaseRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => releaseRecord(id),
    onSuccess: (data) => {
      patchRecordInListCaches(qc, data.id, {
        status: data.status,
        previousStatus: undefined,
      });
      qc.setQueryData(recordKeys.detail(data.id), (old: Record | undefined) =>
        old ? { ...old, status: data.status, previousStatus: undefined } : old
      );
    },
  });
}

export function useProcessAI() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: ProcessAIPayload;
    }) => processRecordAI(id, payload),
    onSuccess: ({ record }) => {
      qc.setQueryData(recordKeys.detail(record.id), record);
      patchRecordInListCaches(qc, record.id, {
        status: record.status,
        previousStatus: record.previousStatus,
        attemptCount: record.attemptCount,
        extraction: record.extraction,
        driverName: record.driverName,
        currentAttemptId: record.currentAttemptId,
      });
    },
  });
}

export function useUpdateExtraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateExtractionPayload;
    }) => updateRecordExtraction(id, payload),
    onSuccess: (data) => {
      qc.setQueryData(recordKeys.detail(data.id), data);
      patchRecordInListCaches(qc, data.id, {
        status: data.status,
        extraction: data.extraction,
        driverName: data.driverName,
      });
    },
  });
}

export function useUpdateStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateStatusPayload;
    }) => updateRecordStatus(id, payload),
    onSuccess: (data) => {
      qc.setQueryData(recordKeys.detail(data.id), data);
      patchRecordInListCaches(qc, data.id, {
        status: data.status,
        errorComment: data.errorComment,
      });
    },
  });
}
