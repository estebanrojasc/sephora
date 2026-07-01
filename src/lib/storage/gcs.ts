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

export async function getSignedReadUrl(objectKey: string): Promise<string> {
  const file = bucket().file(objectKey);
  const [url] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + getSignedUrlTtlMs(),
  });
  return url;
}

export async function getSignedWriteUrl(
  objectKey: string,
  contentType: string
): Promise<string> {
  return withGcsRetry(async () => {
    const file = bucket().file(objectKey);
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires: Date.now() + getUploadSignedUrlTtlMs(),
      contentType,
    });
    return url;
  });
}

export async function downloadObjectAsBuffer(
  objectKey: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const file = bucket().file(objectKey);
  const [buffer] = await file.download();
  const [metadata] = await file.getMetadata();
  return {
    buffer,
    contentType: metadata.contentType ?? "image/jpeg",
  };
}

export async function objectExists(objectKey: string): Promise<boolean> {
  const [exists] = await bucket().file(objectKey).exists();
  return exists;
}

/** Verifica que las credenciales GCS puedan obtener token OAuth (Railway ↔ Google). */
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
    await withGcsRetry(async () => {
      const file = bucket().file("_healthcheck/ping.txt");
      await file.getSignedUrl({
        version: "v4",
        action: "write",
        expires: Date.now() + 60_000,
        contentType: "text/plain",
      });
    });
    return { ok: true, ms: Date.now() - started };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, ms: Date.now() - started, error: message };
  }
}

export { isGcsConfigured };
