import { fetchJsonNoStore } from "@/lib/fetch-client";
import {
  dataUrlContentType,
  dataUrlToBlob,
  putBlobToSignedUrl,
} from "@/lib/data-url-client";
import type {
  CompleteDirectUploadPayload,
  Extraction,
  PrepareDirectUploadPayload,
  PrepareDirectUploadResponse,
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

async function uploadRecordImagesLegacy(
  payload: UploadPayload
): Promise<Record> {
  return fetchJsonNoStore<Record>("/api/records/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function uploadRecordImagesDirectToGcs(
  payload: UploadPayload
): Promise<Record> {
  const prepareBody: PrepareDirectUploadPayload = {
    deviceId: payload.deviceId,
    driverId: payload.driverId,
    driverName: payload.driverName,
    recordId: payload.recordId,
    images: payload.images.map((img) => ({
      originalContentType: dataUrlContentType(img.dataUrl),
      processedContentType: img.processedDataUrl
        ? dataUrlContentType(img.processedDataUrl)
        : undefined,
    })),
  };

  const prepareRes = await fetch("/api/records/upload/prepare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prepareBody),
    cache: "no-store",
  });

  if (prepareRes.status === 503) {
    const errBody = (await prepareRes.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
    };
    if (errBody.code === "GCS_NOT_CONFIGURED") {
      return uploadRecordImagesLegacy(payload);
    }
    throw new Error(
      errBody.message ?? "No se pudo conectar con Google Cloud Storage"
    );
  }

  if (!prepareRes.ok) {
    const errBody = (await prepareRes.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(errBody.message ?? "No se pudo preparar la subida");
  }

  const prepare = (await prepareRes.json()) as PrepareDirectUploadResponse;

  await Promise.all(
    prepare.uploads.flatMap((slot, index) => {
      const img = payload.images[index];
      const original = dataUrlToBlob(img.dataUrl);
      const tasks: Promise<void>[] = [
        putBlobToSignedUrl(
          slot.original.uploadUrl,
          original.blob,
          slot.original.contentType
        ),
      ];
      if (slot.processed && img.processedDataUrl) {
        const processed = dataUrlToBlob(img.processedDataUrl);
        tasks.push(
          putBlobToSignedUrl(
            slot.processed.uploadUrl,
            processed.blob,
            slot.processed.contentType
          )
        );
      }
      return tasks;
    })
  );

  const completeBody: CompleteDirectUploadPayload = {
    recordId: prepare.recordId,
    deviceId: payload.deviceId,
    driverId: payload.driverId,
    driverName: payload.driverName,
    asAdmin: prepare.asAdmin,
    images: prepare.uploads.map((slot, index) => ({
      id: slot.imageId,
      url: slot.original.key,
      processedUrl: slot.processed?.key,
      name: payload.images[index].name,
    })),
  };

  return fetchJsonNoStore<Record>("/api/records/upload/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(completeBody),
  });
}

export async function uploadRecordImages(
  payload: UploadPayload
): Promise<Record> {
  return uploadRecordImagesDirectToGcs(payload);
}

export async function deleteRecordApi(id: string): Promise<{ ok: boolean; id: string }> {
  return fetchJsonNoStore(`/api/records/${id}`, { method: "DELETE" });
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
