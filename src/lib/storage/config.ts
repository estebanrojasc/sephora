import "server-only";

const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;

export interface GcsServiceAccountCredentials {
  project_id?: string;
  client_email: string;
  private_key: string;
}

/** Convierte `\n` literales del .env en saltos de línea reales. */
export function normalizePrivateKey(key: string): string {
  return key.replace(/\\n/g, "\n").trim();
}

function isValidPrivateKey(key: string): boolean {
  return (
    key.includes("BEGIN PRIVATE KEY") && key.includes("END PRIVATE KEY")
  );
}

export function getGcsCredentials(): GcsServiceAccountCredentials | null {
  const json = process.env.GCS_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      const parsed = JSON.parse(json) as GcsServiceAccountCredentials;
      if (!parsed.client_email || !parsed.private_key) {
        return null;
      }
      const private_key = normalizePrivateKey(parsed.private_key);
      if (!isValidPrivateKey(private_key)) {
        return null;
      }
      return {
        project_id: parsed.project_id,
        client_email: parsed.client_email,
        private_key,
      };
    } catch {
      return null;
    }
  }

  const email = process.env.GCS_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GCS_PRIVATE_KEY?.trim();
  if (email && privateKey) {
    const private_key = normalizePrivateKey(privateKey);
    if (!isValidPrivateKey(private_key)) {
      return null;
    }
    return {
      project_id: process.env.GCS_PROJECT_ID?.trim(),
      client_email: email,
      private_key,
    };
  }

  return null;
}

export function getGcsCredentialsError(): string | null {
  const bucket = process.env.GCS_BUCKET?.trim();
  if (!bucket) return "GCS_BUCKET no definido";

  const json = process.env.GCS_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      const parsed = JSON.parse(json) as GcsServiceAccountCredentials;
      if (!parsed.client_email || !parsed.private_key) {
        return "GCS_SERVICE_ACCOUNT_JSON incompleto (client_email o private_key)";
      }
      if (!isValidPrivateKey(normalizePrivateKey(parsed.private_key))) {
        return "GCS_SERVICE_ACCOUNT_JSON: private_key mal formateada";
      }
      return null;
    } catch {
      return "GCS_SERVICE_ACCOUNT_JSON no es JSON válido";
    }
  }

  const email = process.env.GCS_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GCS_PRIVATE_KEY?.trim();
  if (!email || !privateKey) {
    return "Faltan GCS_CLIENT_EMAIL y/o GCS_PRIVATE_KEY";
  }
  if (!isValidPrivateKey(normalizePrivateKey(privateKey))) {
    return "GCS_PRIVATE_KEY mal formateada (debe incluir BEGIN/END PRIVATE KEY)";
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

const DEFAULT_UPLOAD_SIGNED_URL_TTL_SECONDS = 900;

/** TTL más corto para URLs de escritura (subida directa desde el navegador). */
export function getUploadSignedUrlTtlMs(): number {
  const raw = process.env.GCS_UPLOAD_URL_TTL_SECONDS?.trim();
  const seconds = raw
    ? Number.parseInt(raw, 10)
    : DEFAULT_UPLOAD_SIGNED_URL_TTL_SECONDS;
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_UPLOAD_SIGNED_URL_TTL_SECONDS * 1000;
  }
  return seconds * 1000;
}
