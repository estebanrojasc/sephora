"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  openRecord,
  processRecordAI,
  releaseRecord,
  updateRecordExtraction,
  updateRecordStatus,
  uploadRecordImages,
} from "./api";
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recordKeys.all });
    },
  });
}

export function useOpenRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => openRecord(id),
    onSuccess: (data) => {
      qc.setQueryData(recordKeys.detail(data.id), (old: Record | undefined) =>
        old
          ? {
              ...old,
              status: data.status,
              previousStatus: data.previousStatus,
            }
          : old
      );
      qc.invalidateQueries({ queryKey: recordKeys.all });
    },
  });
}

export function useReleaseRecord() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => releaseRecord(id),
    onSuccess: (data) => {
      qc.setQueryData(recordKeys.detail(data.id), (old: Record | undefined) =>
        old ? { ...old, status: data.status, previousStatus: undefined } : old
      );
      qc.invalidateQueries({ queryKey: recordKeys.all });
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
      qc.invalidateQueries({ queryKey: recordKeys.all });
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
      qc.invalidateQueries({ queryKey: recordKeys.all });
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
      qc.invalidateQueries({ queryKey: recordKeys.all });
    },
  });
}
