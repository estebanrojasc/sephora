import "server-only";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;

export interface GcsServiceAccountCredentials {
  project_id?: string;
  client_email: string;
  private_key: string;
}

/** Convierte `\n` literales del .env en saltos de línea reales. */
export function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, "\n");
}

export function getGcsCredentials(): GcsServiceAccountCredentials | null {
  const json = process.env.GCS_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const parsed = JSON.parse(json) as GcsServiceAccountCredentials;
    if (!parsed.client_email || !parsed.private_key) {
      throw new Error(
        "GCS_SERVICE_ACCOUNT_JSON debe incluir client_email y private_key"
      );
    }
    return {
      project_id: parsed.project_id,
      client_email: parsed.client_email,
      private_key: normalizePrivateKey(parsed.private_key),
    };
  }

  const email = process.env.GCS_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GCS_PRIVATE_KEY?.trim();
  if (email && privateKey) {
    return {
      project_id: process.env.GCS_PROJECT_ID?.trim(),
      client_email: email,
      private_key: normalizePrivateKey(privateKey),
    };
  }

  return null;
}

export function isGcsConfigured(): boolean {
  const bucket = process.env.GCS_BUCKET?.trim();
  if (!bucket) return false;
  if (getGcsCredentials()) return true;
  return Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim());
}

export function getGcsBucketName(): string {
  const bucket = process.env.GCS_BUCKET?.trim();
  if (!bucket) {
    throw new Error("GCS_BUCKET no configurado");
  }
  return bucket;
}

export function getGcsProjectId(): string | undefined {
  return (
    process.env.GCS_PROJECT_ID?.trim() ?? getGcsCredentials()?.project_id
  );
}

export function getSignedUrlTtlMs(): number {
  const raw = process.env.GCS_SIGNED_URL_TTL_SECONDS?.trim();
  const seconds = raw ? Number.parseInt(raw, 10) : DEFAULT_SIGNED_URL_TTL_SECONDS;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_SIGNED_URL_TTL_SECONDS * 1000;
  }
  return seconds * 1000;
}
