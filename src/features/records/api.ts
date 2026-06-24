import type {
  Extraction,
  ProcessAIPayload,
  Record,
  RecordStatus,
  UpdateExtractionPayload,
  UpdateStatusPayload,
  UploadPayload,
} from "./types";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? "Error de red");
  }
  return res.json() as Promise<T>;
}

export async function fetchRecords(params?: {
  status?: RecordStatus | "all";
  deviceId?: string;
}): Promise<Record[]> {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.deviceId) search.set("deviceId", params.deviceId);
  const qs = search.toString();
  const res = await fetch(`/api/records${qs ? `?${qs}` : ""}`);
  return handleResponse<Record[]>(res);
}

export async function fetchRecord(id: string): Promise<Record> {
  const res = await fetch(`/api/records/${id}`);
  return handleResponse<Record>(res);
}

export async function uploadRecordImages(
  payload: UploadPayload
): Promise<Record> {
  const res = await fetch("/api/records/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<Record>(res);
}

export async function openRecord(id: string): Promise<Record> {
  const res = await fetch(`/api/records/${id}/open`, { method: "POST" });
  return handleResponse<Record>(res);
}

export async function releaseRecord(id: string): Promise<Record> {
  const res = await fetch(`/api/records/${id}/release`, { method: "POST" });
  return handleResponse<Record>(res);
}

export async function processRecordAI(
  id: string,
  payload: ProcessAIPayload
): Promise<{ extraction: Extraction; record: Record }> {
  const res = await fetch(`/api/records/${id}/process-ai`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ extraction: Extraction; record: Record }>(res);
}

export async function updateRecordExtraction(
  id: string,
  payload: UpdateExtractionPayload
): Promise<Record> {
  const res = await fetch(`/api/records/${id}/extraction`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<Record>(res);
}

export async function updateRecordStatus(
  id: string,
  payload: UpdateStatusPayload
): Promise<Record> {
  const res = await fetch(`/api/records/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<Record>(res);
}
