import "server-only";
import type { Record, RecordImage } from "@/features/records/types";
import type { VisionProvider } from "@/features/vision/types";
import {
  downloadObjectAsBuffer,
  getSignedReadUrl,
  isGcsConfigured,
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
  record: Record
): Promise<Record> {
  const images = await Promise.all(
    record.images.map(async (img) => ({
      ...img,
      url: await resolveRefForClient(img.url),
      processedUrl: img.processedUrl
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
