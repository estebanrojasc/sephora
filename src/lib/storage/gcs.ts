import "server-only";
import { Storage, type StorageOptions } from "@google-cloud/storage";
import {
  getGcsBucketName,
  getGcsCredentials,
  getGcsProjectId,
  getSignedUrlTtlMs,
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

export { isGcsConfigured };
