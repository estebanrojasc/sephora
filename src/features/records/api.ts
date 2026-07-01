import { fetchJsonNoStore } from "@/lib/fetch-client";
import type {
  Extraction,
  ProcessAIPayload,
  Record,
  RecordStatus,
  RecordStatusPatch,
  UpdateExtractionPayload,
  UpdateStatusPayload,
  UploadPayload,
} from "./types";

export async function fetchRecords(params?: {
  status?: RecordStatus | "all";
  deviceId?: string;
}): Promise<Record[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.deviceId) search.set("deviceId", params.deviceId);
  const qs = search.toString();
  return fetchJsonNoStore<Record[]>(`/api/records${qs ? `?${qs}` : ""}`);
}

export async function fetchRecord(id: string): Promise<Record> {
  return fetchJsonNoStore<Record>(`/api/records/${id}`);
}

export async function uploadRecordImages(
  payload: UploadPayload
): Promise<Record> {
  return fetchJsonNoStore<Record>("/api/records/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function openRecord(id: string): Promise<RecordStatusPatch> {
  return fetchJsonNoStore<RecordStatusPatch>(`/api/records/${id}/open`, {
    method: "POST",
  });
}

export async function releaseRecord(id: string): Promise<RecordStatusPatch> {
  return fetchJsonNoStore<RecordStatusPatch>(`/api/records/${id}/release`, {
    method: "POST",
  });
}

export async function processRecordAI(
  id: string,
  payload: ProcessAIPayload
): Promise<{ extraction: Extraction; record: Record }> {
  return fetchJsonNoStore<{ extraction: Extraction; record: Record }>(
    `/api/records/${id}/process-ai`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

export async function updateRecordExtraction(
  id: string,
  payload: UpdateExtractionPayload
): Promise<Record> {
  return fetchJsonNoStore<Record>(`/api/records/${id}/extraction`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function updateRecordStatus(
  id: string,
  payload: UpdateStatusPayload
): Promise<Record> {
  return fetchJsonNoStore<Record>(`/api/records/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
