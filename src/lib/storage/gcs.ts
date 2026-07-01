import "server-only";
import { Storage, type StorageOptions } from "@google-cloud/storage";
import {
  getGcsBucketName,
  getGcsCredentials,
  getGcsProjectId,
  getSignedUrlTtlMs,
  getUploadSignedUrlTtlMs,
  isGcsConfigured,
} from "@/lib/storage/config";
import { canSignGcsUrls, signGcsV4Url } from "@/lib/storage/gcs-sign";
import { parseDataUrl } from "@/lib/storage/image-ref";

let storageClient: Storage | null = null;

function getStorage(): Storage {
  if (storageClient) return storageClient;

  const credentials = getGcsCredentials();
  const options: StorageOptions = {};

  if (credentials) {
    options.projectId = getGcsProjectId();
    options.credentials = {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    };
  } else if (getGcsProjectId()) {
    options.projectId = getGcsProjectId();
  }

  storageClient = new Storage(options);
  return storageClient;
}

function bucket() {
  return getStorage().bucket(getGcsBucketName());
}

async function withGcsRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code?: string }).code)
          : "";
      const retryable =
        code === "ERR_STREAM_PREMATURE_CLOSE" ||
        code === "ECONNRESET" ||
        code === "ETIMEDOUT" ||
        code === "ENOTFOUND";
      if (!retryable || i === attempts - 1) break;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  throw lastError;
}

export async function uploadBufferToGcs(
  objectKey: string,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  const file = bucket().file(objectKey);
  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: { cacheControl: "private, max-age=3600" },
  });
  return objectKey;
}

export async function uploadDataUrlToGcs(
  dataUrl: string,
  objectKey: string
): Promise<string> {
  const { mimeType, buffer } = parseDataUrl(dataUrl);
  return uploadBufferToGcs(objectKey, buffer, mimeType);
}

export function getSignedReadUrl(objectKey: string): string {
  return signGcsV4Url({
    objectKey,
    method: "GET",
    expiresMs: getSignedUrlTtlMs(),
  });
}

export function getSignedWriteUrl(
  objectKey: string,
  contentType: string
): string {
  return signGcsV4Url({
    objectKey,
    method: "PUT",
    expiresMs: getUploadSignedUrlTtlMs(),
    contentType,
  });
}

export async function downloadObjectAsBuffer(
  objectKey: string
): Promise<{ buffer: Buffer; contentType: string }> {
  if (getGcsCredentials()) {
    const url = getSignedReadUrl(objectKey);
    const res = await withGcsRetry(async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`No se pudo descargar ${objectKey} (${response.status})`);
      }
      return response;
    });
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    return { buffer, contentType };
  }

  const file = bucket().file(objectKey);
  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();
  return {
    buffer,
    contentType: metadata.contentType ?? "image/jpeg",
  };
}

export async function objectExists(objectKey: string): Promise<boolean> {
  if (getGcsCredentials()) {
    const url = getSignedReadUrl(objectKey);
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  }
  const [exists] = await bucket().file(objectKey).exists();
  return exists;
}

/** Verifica firma local + existencia vía HEAD (sin OAuth). */
export async function objectExistsViaSignedUrl(
  objectKey: string
): Promise<boolean> {
  return withGcsRetry(async () => {
    const url = getSignedReadUrl(objectKey);
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  });
}

/** Verifica que la private key puede firmar URLs (sin llamar a OAuth). */
export async function pingGcsAuth(): Promise<{
  ok: boolean;
  ms: number;
  error?: string;
}> {
  if (!isGcsConfigured()) {
    return { ok: false, ms: 0, error: "GCS no configurado" };
  }
  const started = Date.now();
  try {
    if (!canSignGcsUrls()) {
      return {
        ok: false,
        ms: Date.now() - started,
        error: "No se pudo firmar con GCS_PRIVATE_KEY (revisa formato en Railway)",
      };
    }
    return {
      ok: true,
      ms: Date.now() - started,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, ms: Date.now() - started, error: message };
  }
}

export { isGcsConfigured };
