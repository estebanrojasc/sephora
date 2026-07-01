import "server-only";
import { randomUUID } from "node:crypto";
import type { Record, RecordImage } from "@/features/records/types";
import type { VisionProvider } from "@/features/vision/types";
import {
  downloadObjectAsBuffer,
  getSignedReadUrl,
  getSignedWriteUrl,
  isGcsConfigured,
  objectExists,
  uploadDataUrlToGcs,
} from "@/lib/storage/gcs";
import {
  isDataUrl,
  isGcsObjectKey,
  isHttpUrl,
  mimeToExt,
  parseDataUrl,
  recordImageObjectKey,
} from "@/lib/storage/image-ref";

async function resolveRefForClient(ref: string): Promise<string> {
  if (isDataUrl(ref) || isHttpUrl(ref)) return ref;
  if (isGcsObjectKey(ref)) return getSignedReadUrl(ref);
  return ref;
}

async function refToDataUrl(ref: string): Promise<string> {
  if (isDataUrl(ref)) return ref;
  if (isGcsObjectKey(ref)) {
    const { buffer, contentType } = await downloadObjectAsBuffer(ref);
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }
  if (isHttpUrl(ref)) {
    const res = await fetch(ref);
    if (!res.ok) {
      throw new Error(`No se pudo descargar imagen (${res.status})`);
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }
  throw new Error(`Referencia de imagen no reconocida: ${ref.slice(0, 80)}`);
}

export async function resolveRecordImagesForClient(
  record: Record,
  opts?: { signProcessed?: boolean }
): Promise<Record> {
  const signProcessed = opts?.signProcessed ?? false;
  const images = await Promise.all(
    record.images.map(async (img) => ({
      ...img,
      url: await resolveRefForClient(img.url),
      processedUrl:
        signProcessed && img.processedUrl
          ? await resolveRefForClient(img.processedUrl)
          : undefined,
    }))
  );
  return { ...record, images };
}

export async function resolveImagesForVision(
  refs: string[],
  provider: VisionProvider
): Promise<string[]> {
  if (provider === "qwen") {
    return Promise.all(
      refs.map(async (ref) => {
        if (isDataUrl(ref) || isHttpUrl(ref)) return ref;
        if (isGcsObjectKey(ref)) return getSignedReadUrl(ref);
        return ref;
      })
    );
  }
  return Promise.all(refs.map(refToDataUrl));
}

export async function uploadRecordImageToGcs(
  recordId: string,
  image: { dataUrl: string; processedDataUrl?: string },
  imageId: string
): Promise<Pick<RecordImage, "url" | "processedUrl">> {
  const { mimeType } = parseDataUrl(image.dataUrl);
  const ext = mimeToExt(mimeType);
  const url = await uploadDataUrlToGcs(
    image.dataUrl,
    recordImageObjectKey(recordId, imageId, "original", ext)
  );

  let processedUrl: string | undefined;
  if (image.processedDataUrl) {
    const processedMime = parseDataUrl(image.processedDataUrl).mimeType;
    const processedExt = mimeToExt(processedMime);
    processedUrl = await uploadDataUrlToGcs(
      image.processedDataUrl,
      recordImageObjectKey(recordId, imageId, "processed", processedExt)
    );
  }

  return { url, processedUrl };
}

export function shouldUseGcsForUpload(): boolean {
  return isGcsConfigured();
}

export interface PreparedImageUpload {
  imageId: string;
  original: { key: string; uploadUrl: string; contentType: string };
  processed?: { key: string; uploadUrl: string; contentType: string };
}

export async function prepareRecordImageUploads(
  recordId: string,
  images: Array<{ originalContentType: string; processedContentType?: string }>
): Promise<PreparedImageUpload[]> {
  if (!isGcsConfigured()) {
    throw new Error("GCS_NOT_CONFIGURED");
  }

  return Promise.all(
    images.map(async (img) => {
      const imageId = randomUUID();
      const origExt = mimeToExt(img.originalContentType);
      const origKey = recordImageObjectKey(
        recordId,
        imageId,
        "original",
        origExt
      );
      const original = {
        key: origKey,
        uploadUrl: await getSignedWriteUrl(origKey, img.originalContentType),
        contentType: img.originalContentType,
      };

      let processed: PreparedImageUpload["processed"];
      if (img.processedContentType) {
        const procExt = mimeToExt(img.processedContentType);
        const procKey = recordImageObjectKey(
          recordId,
          imageId,
          "processed",
          procExt
        );
        processed = {
          key: procKey,
          uploadUrl: await getSignedWriteUrl(procKey, img.processedContentType),
          contentType: img.processedContentType,
        };
      }

      return { imageId, original, processed };
    })
  );
}

function assertRecordImageKey(
  recordId: string,
  imageId: string,
  key: string,
  variant: "original" | "processed"
): void {
  const prefix = `records/${recordId}/${imageId}/${variant}.`;
  if (!key.startsWith(prefix)) {
    throw new Error(`Clave GCS inválida para imagen ${imageId}`);
  }
}

export async function verifyDirectUploadObjects(
  recordId: string,
  images: Array<{ id: string; url: string; processedUrl?: string }>
): Promise<void> {
  for (const img of images) {
    assertRecordImageKey(recordId, img.id, img.url, "original");
    if (img.processedUrl) {
      assertRecordImageKey(recordId, img.id, img.processedUrl, "processed");
    }
  }

  const checks = images.flatMap((img) => {
    const tasks = [objectExists(img.url)];
    if (img.processedUrl) tasks.push(objectExists(img.processedUrl));
    return tasks;
  });
  const results = await Promise.all(checks);
  if (results.some((ok) => !ok)) {
    throw new Error("Faltan objetos en GCS; reintenta la subida");
  }
}
