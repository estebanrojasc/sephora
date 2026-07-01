import "server-only";
import { randomUUID } from "node:crypto";
import { COLLECTIONS, collectionWithIndexes } from "@/lib/mongo";
import {
  createEmptyExtraction,
  type Extraction,
  type Record,
  type RecordImage,
  type RecordStatus,
  type UploadPayload,
  type UpdateExtractionPayload,
} from "@/features/records/types";

async function col() {
  return collectionWithIndexes<Record>(COLLECTIONS.records, [
    { key: { id: 1 }, unique: true },
    { key: { deviceId: 1, createdAt: -1 } },
    { key: { status: 1, createdAt: -1 } },
  ]);
}

function stripMongoId<T extends { _id?: unknown }>(doc: T | null): T | null {
  if (!doc) return null;
  const { _id: _ignored, ...rest } = doc;
  void _ignored;
  return rest as T;
}

export async function listRecords(filters?: {
  status?: RecordStatus | "all";
  deviceId?: string;
}): Promise<Record[]> {
  const c = await col();
  const query: { status?: RecordStatus; deviceId?: string } = {};
  if (filters?.status && filters.status !== "all") {
    query.status = filters.status as RecordStatus;
  }
  if (filters?.deviceId) query.deviceId = filters.deviceId;
  const docs = await c.find(query, { sort: { createdAt: 1 } }).toArray();
  return docs.map((d) => stripMongoId(d) as Record);
}

export async function findRecordById(id: string): Promise<Record | null> {
  const c = await col();
  return stripMongoId(await c.findOne({ id }));
}

export async function insertRecord(payload: UploadPayload): Promise<Record> {
  const now = new Date().toISOString();
  const images: RecordImage[] = payload.images.map((img) => ({
    id: randomUUID(),
    url: img.dataUrl,
    processedUrl: img.processedDataUrl,
    createdAt: now,
  }));
  const record: Record = {
    id: randomUUID(),
    deviceId: payload.deviceId,
    driverId: payload.driverId,
    driverName: payload.driverName,
    status: "uploaded",
    createdAt: now,
    updatedAt: now,
    images,
    attemptCount: 0,
  };
  await (await col()).insertOne(record);
  return record;
}

export async function insertRecordFromBitacora(
  partial: Omit<Record, "id" | "createdAt" | "updatedAt">
): Promise<Record> {
  const now = new Date().toISOString();
  const record: Record = {
    id: randomUUID(),
    ...partial,
    createdAt: now,
    updatedAt: now,
  };
  await (await col()).insertOne(record);
  return record;
}

export async function findRecordsByIds(ids: string[]): Promise<Record[]> {
  if (ids.length === 0) return [];
  const c = await col();
  const docs = await c.find({ id: { $in: ids } }).toArray();
  const byId = new Map(docs.map((d) => [d.id, stripMongoId(d) as Record]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is Record => r != null);
}

async function patchRecord(
  id: string,
  patch: Partial<Record>
): Promise<Record | null> {
  const c = await col();
  const updated = await c.findOneAndUpdate(
    { id },
    { $set: { ...patch, updatedAt: new Date().toISOString() } },
    { returnDocument: "after" }
  );
  return stripMongoId(updated);
}

export async function openForReview(id: string): Promise<Record | null> {
  const record = await findRecordById(id);
  if (!record) return null;
  if (record.status === "uploaded" || record.status === "errors") {
    return patchRecord(id, {
      previousStatus: record.status,
      status: "in_review",
    });
  }
  return record;
}

export async function releaseFromReview(id: string): Promise<Record | null> {
  const record = await findRecordById(id);
  if (!record) return null;
  if (record.status !== "in_review") return record;
  const newStatus: RecordStatus = record.previousStatus ?? "uploaded";
  return patchRecord(id, {
    status: newStatus,
    previousStatus: undefined,
  });
}

export async function saveExtraction(
  id: string,
  extraction: Extraction,
  attemptId?: string
): Promise<Record | null> {
  const patch: Partial<Record> = { extraction };
  if (attemptId) {
    patch.currentAttemptId = attemptId;
  }
  const conductor = extraction.conductor?.valor?.trim();
  if (conductor) {
    patch.driverName = conductor;
  }
  return patchRecord(id, patch);
}

export interface ApplyExtractionPatchResult {
  record: Record;
  previousExtraction?: Extraction;
  nextExtraction: Extraction;
}

export async function applyExtractionPatch(
  id: string,
  patch: UpdateExtractionPayload
): Promise<ApplyExtractionPatchResult | null> {
  const record = await findRecordById(id);
  if (!record) return null;
  const previousExtraction = record.extraction;
  const base = previousExtraction ?? createEmptyExtraction();
  const next: Extraction = {
    ...base,
    ...patch,
    rendicion: { ...base.rendicion, ...(patch.rendicion ?? {}) },
    detalle_efectivo: {
      ...base.detalle_efectivo,
      ...(patch.detalle_efectivo ?? {}),
    },
    _meta: {
      ...(base._meta ?? {
        confidence: 0,
        processedImageIds: [],
        processedAt: new Date().toISOString(),
      }),
      ...(patch._meta ?? {}),
      manualOverride: true,
    },
  };
  const recordPatch: Partial<Record> = { extraction: next };
  const conductor = next.conductor?.valor?.trim();
  if (conductor) {
    recordPatch.driverName = conductor;
  }
  const updated = await patchRecord(id, recordPatch);
  if (!updated) return null;
  return { record: updated, previousExtraction, nextExtraction: next };
}

export async function setStatus(
  id: string,
  status: RecordStatus,
  errorComment?: string
): Promise<Record | null> {
  return patchRecord(id, {
    status,
    errorComment: status === "errors" ? errorComment : undefined,
    previousStatus: undefined,
  });
}

export async function markImageProcessed(
  recordId: string,
  imageId: string
): Promise<void> {
  const c = await col();
  await c.updateOne(
    { id: recordId, "images.id": imageId },
    {
      $set: {
        "images.$.processedAt": new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    }
  );
}

export async function incrementAttemptCount(
  recordId: string
): Promise<void> {
  const c = await col();
  await c.updateOne(
    { id: recordId },
    { $inc: { attemptCount: 1 }, $set: { updatedAt: new Date().toISOString() } }
  );
}

