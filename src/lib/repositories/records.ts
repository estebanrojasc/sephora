import "server-only";
import { randomUUID } from "node:crypto";
import { COLLECTIONS, collectionWithIndexes } from "@/lib/mongo";
import {
  canAppendImagesToRecord,
  createEmptyExtraction,
  type Extraction,
  type Record,
  type RecordImage,
  type RecordStatus,
  type UploadPayload,
  type CompleteDirectUploadPayload,
  type UpdateExtractionPayload,
} from "@/features/records/types";
import {
  LIST_RECORDS_PROJECTION,
  normalizeListRecord,
} from "@/lib/repositories/record-list-projection";
import {
  EXCEL_RECORD_PROJECTION,
  normalizeExcelRecord,
  RECORD_DETAIL_PROJECTION,
} from "@/lib/repositories/record-projections";
import {
  shouldUseGcsForUpload,
  uploadRecordImageToGcs,
  verifyDirectUploadObjects,
} from "@/lib/storage/record-images";

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

/** Registro con al menos una corrida de IA (aunque el estado quedó desincronizado). */
export function recordHasAiWork(
  record: Pick<Record, "attemptCount" | "extraction" | "currentAttemptId">
): boolean {
  if ((record.attemptCount ?? 0) > 0) return true;
  if (record.currentAttemptId) return true;
  const meta = record.extraction?._meta;
  if (!meta) return false;
  if (meta.processedAt) return true;
  if ((meta.processedImageIds?.length ?? 0) > 0) return true;
  if (meta.lastProvider || meta.source) return true;
  return false;
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
  const docs = await c
    .find(query, {
      sort: { createdAt: -1 },
      projection: LIST_RECORDS_PROJECTION,
      maxTimeMS: 25_000,
    })
    .toArray();
  return docs.map((d) => normalizeListRecord(stripMongoId(d) as Record));
}

export async function findRecordById(id: string): Promise<Record | null> {
  const c = await col();
  return stripMongoId(await c.findOne({ id }));
}

export async function findRecordByIdForDetail(id: string): Promise<Record | null> {
  const c = await col();
  return stripMongoId(
    await c.findOne({ id }, { projection: RECORD_DETAIL_PROJECTION, maxTimeMS: 25_000 })
  );
}

export async function findRecordsByIdsForExcel(ids: string[]): Promise<Record[]> {
  if (ids.length === 0) return [];
  const c = await col();
  const docs = await c
    .find({ id: { $in: ids } }, { projection: EXCEL_RECORD_PROJECTION, maxTimeMS: 60_000 })
    .toArray();
  const byId = new Map(
    docs.map((d) => [d.id, normalizeExcelRecord(stripMongoId(d) as Record)])
  );
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is Record => r != null);
}

function buildLegacyImages(
  recordId: string,
  payloadImages: UploadPayload["images"],
  useGcs: boolean,
  now: string
): Promise<RecordImage[]> | RecordImage[] {
  if (useGcs) {
    return Promise.all(
      payloadImages.map(async (img) => {
        const imageId = randomUUID();
        const refs = await uploadRecordImageToGcs(recordId, img, imageId);
        return {
          id: imageId,
          url: refs.url,
          processedUrl: refs.processedUrl,
          createdAt: now,
        };
      })
    );
  }
  return payloadImages.map((img) => ({
    id: randomUUID(),
    url: img.dataUrl,
    processedUrl: img.processedDataUrl,
    createdAt: now,
  }));
}

/** Tras añadir imágenes, limpia processedImageIds para forzar re-procesado IA. */
function clearProcessedImageIds(extraction: Extraction | undefined): Extraction | undefined {
  if (!extraction?._meta) return extraction;
  return {
    ...extraction,
    _meta: {
      ...extraction._meta,
      processedImageIds: [],
    },
  };
}

export async function insertRecord(payload: UploadPayload): Promise<Record> {
  if (payload.recordId) {
    return appendImagesToRecord(payload.recordId, payload);
  }

  const now = new Date().toISOString();
  const recordId = randomUUID();
  const useGcs = shouldUseGcsForUpload();
  const images = await buildLegacyImages(
    recordId,
    payload.images,
    useGcs,
    now
  );

  const record: Record = {
    id: recordId,
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

export async function appendImagesToRecord(
  recordId: string,
  payload: Pick<
    UploadPayload,
    "deviceId" | "driverId" | "driverName" | "images"
  >,
  options?: { asAdmin?: boolean }
): Promise<Record> {
  const existing = await findRecordById(recordId);
  if (!existing) {
    throw new Error("RECORD_NOT_FOUND");
  }
  if (!options?.asAdmin && existing.deviceId !== payload.deviceId) {
    throw new Error("DEVICE_MISMATCH");
  }
  if (!canAppendImagesToRecord(existing.status)) {
    throw new Error("RECORD_NOT_APPENDABLE");
  }

  const now = new Date().toISOString();
  const useGcs = shouldUseGcsForUpload();
  const newImages = await buildLegacyImages(
    recordId,
    payload.images,
    useGcs,
    now
  );

  return pushImagesToRecord(recordId, existing, newImages);
}

async function pushImagesToRecord(
  recordId: string,
  existing: Record,
  newImages: RecordImage[]
): Promise<Record> {
  const now = new Date().toISOString();
  const extraction = clearProcessedImageIds(existing.extraction);
  const c = await col();

  const setFields: { [key: string]: unknown } = { updatedAt: now };
  if (extraction) setFields.extraction = extraction;

  const unsetFields: { [key: string]: "" } = {};
  if (existing.status === "errors") {
    setFields.status = "uploaded";
    unsetFields.errorComment = "";
  }

  const updated = await c.findOneAndUpdate(
    { id: recordId },
    {
      $push: { images: { $each: newImages } },
      $set: setFields,
      ...(Object.keys(unsetFields).length > 0 ? { $unset: unsetFields } : {}),
    },
    { returnDocument: "after" }
  );
  const result = stripMongoId(updated);
  if (!result) throw new Error("RECORD_NOT_FOUND");
  return result;
}

export async function completeDirectRecordUpload(
  payload: CompleteDirectUploadPayload
): Promise<Record> {
  const existing = await (await col()).findOne({ id: payload.recordId });

  await verifyDirectUploadObjects(payload.recordId, payload.images);

  const now = new Date().toISOString();
  const images: RecordImage[] = payload.images.map((img) => ({
    id: img.id,
    url: img.url,
    processedUrl: img.processedUrl,
    createdAt: now,
  }));

  if (existing) {
    const record = stripMongoId(existing) as Record;
    // Idempotencia: si ya están todas las imágenes, devolver el record.
    const existingIds = new Set(record.images.map((i) => i.id));
    const allPresent = images.every((img) => existingIds.has(img.id));
    if (allPresent && images.length > 0) {
      return record;
    }

    // Append: solo imágenes nuevas (deviceId validado en prepare/route).
    if (!canAppendImagesToRecord(record.status)) {
      throw new Error("RECORD_NOT_APPENDABLE");
    }
    if (
      record.deviceId !== payload.deviceId &&
      !payload.asAdmin
    ) {
      throw new Error("DEVICE_MISMATCH");
    }
    const toAdd = images.filter((img) => !existingIds.has(img.id));
    if (toAdd.length === 0) return record;
    return pushImagesToRecord(payload.recordId, record, toAdd);
  }

  const record: Record = {
    id: payload.recordId,
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

export async function deleteRecord(id: string): Promise<Record | null> {
  const c = await col();
  const existing = await c.findOne({ id });
  if (!existing) return null;
  await c.deleteOne({ id });
  return stripMongoId(existing);
}

/** Claves GCS (original + processed) de las imágenes de un registro. */
export function collectRecordGcsKeys(record: Record): string[] {
  const keys: string[] = [];
  for (const img of record.images) {
    if (img.url.startsWith("records/")) keys.push(img.url);
    if (img.processedUrl?.startsWith("records/")) keys.push(img.processedUrl);
  }
  return keys;
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

  if (recordHasAiWork(record)) return record;

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
  const record = await findRecordById(id);
  if (!record) return null;

  const patch: Partial<Record> = { extraction };
  if (attemptId) {
    patch.currentAttemptId = attemptId;
  }
  const conductor = extraction.conductor?.valor?.trim();
  if (conductor) {
    patch.driverName = conductor;
  }

  const mergedForCheck: Record = {
    ...record,
    extraction,
    currentAttemptId: attemptId ?? record.currentAttemptId,
  };
  if (
    recordHasAiWork(mergedForCheck) &&
    (record.status === "uploaded" || record.status === "errors")
  ) {
    patch.previousStatus = record.previousStatus ?? record.status;
    patch.status = "in_review";
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

