import "server-only";
import { createHash, createSign } from "node:crypto";
import { getGcsBucketName, getGcsCredentials } from "@/lib/storage/config";

const GCS_HOST = "storage.googleapis.com";
const ALGORITHM = "GOOG4-RSA-SHA256";
/** Región usada en el credential scope para URLs firmadas v4. */
const SIGNING_REGION = "auto";

function encodeObjectPath(objectKey: string): string {
  return objectKey.split("/").map(encodeURIComponent).join("/");
}

function formatSigningDate(date: Date): { datetime: string; datestamp: string } {
  const datetime = date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  return { datetime, datestamp: datetime.slice(0, 8) };
}

function buildCanonicalQueryString(
  params: Record<string, string>
): string {
  return Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    )
    .join("&");
}

/**
 * Firma URLs v4 de GCS localmente con la private key.
 * No llama a oauth2/v4/token (evita fallos de red Railway ↔ Google OAuth).
 */
export function signGcsV4Url(options: {
  objectKey: string;
  method: "GET" | "PUT";
  expiresMs: number;
  contentType?: string;
}): string {
  const creds = getGcsCredentials();
  if (!creds) {
    throw new Error("Credenciales GCS requeridas para firmar URLs");
  }

  const bucket = getGcsBucketName();
  const now = new Date();
  const { datetime, datestamp } = formatSigningDate(now);
  const expiresSec = Math.max(1, Math.floor(options.expiresMs / 1000));
  const credentialScope = `${datestamp}/${SIGNING_REGION}/storage/goog4_request`;
  const credential = `${creds.client_email}/${credentialScope}`;
  const canonicalUri = `/${bucket}/${encodeObjectPath(options.objectKey)}`;

  const signedHeadersList =
    options.method === "PUT" && options.contentType
      ? ["content-type", "host"]
      : ["host"];

  const canonicalHeaders =
    options.method === "PUT" && options.contentType
      ? `content-type:${options.contentType}\nhost:${GCS_HOST}\n`
      : `host:${GCS_HOST}\n`;

  const signedHeaders = signedHeadersList.join(";");

  const queryParams: Record<string, string> = {
    "X-Goog-Algorithm": ALGORITHM,
    "X-Goog-Credential": credential,
    "X-Goog-Date": datetime,
    "X-Goog-Expires": String(expiresSec),
    "X-Goog-SignedHeaders": signedHeaders,
  };

  const canonicalQueryString = buildCanonicalQueryString(queryParams);

  const canonicalRequest = [
    options.method,
    canonicalUri,
    canonicalQueryString,
    canonicalHeaders,
    signedHeaders,
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const requestHash = createHash("sha256")
    .update(canonicalRequest)
    .digest("hex");

  const stringToSign = [
    ALGORITHM,
    datetime,
    credentialScope,
    requestHash,
  ].join("\n");

  const signature = createSign("RSA-SHA256")
    .update(stringToSign)
    .sign(creds.private_key, "hex");

  const finalQuery = `${canonicalQueryString}&X-Goog-Signature=${signature}`;
  return `https://${GCS_HOST}${canonicalUri}?${finalQuery}`;
}

/** Comprueba que la private key puede firmar (sin red). */
export function canSignGcsUrls(): boolean {
  try {
    signGcsV4Url({
      objectKey: "_healthcheck/ping.txt",
      method: "GET",
      expiresMs: 60_000,
    });
    return true;
  } catch {
    return false;
  }
}
