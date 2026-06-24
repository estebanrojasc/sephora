import "server-only";
import type { VisionProvider } from "./types";

/**
 * Códigos de estado HTTP que consideramos transitorios y disparan fallback
 * al otro proveedor de visión.
 *
 * - 408 Request Timeout
 * - 425 Too Early
 * - 429 Too Many Requests (rate limit / cuota)
 * - 500 Internal Server Error
 * - 502 Bad Gateway
 * - 503 Service Unavailable (e.g. "UNAVAILABLE" de Gemini)
 * - 504 Gateway Timeout
 */
const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

/**
 * Códigos textuales (campo `status` en errores de Gemini / Google APIs) que
 * también indican que vale la pena reintentar con otro proveedor.
 */
const RETRYABLE_GOOGLE_CODES = new Set([
  "UNAVAILABLE",
  "RESOURCE_EXHAUSTED",
  "INTERNAL",
  "DEADLINE_EXCEEDED",
  "ABORTED",
]);

export type VisionErrorKind =
  | "network"
  | "http"
  | "auth"
  | "config"
  | "empty"
  | "parse";

export interface VisionProviderErrorInit {
  provider: VisionProvider;
  kind: VisionErrorKind;
  status?: number;
  code?: string;
  retryable?: boolean;
  /**
   * Sugerencia del servidor sobre cuánto esperar antes de reintentar
   * (típicamente del header `Retry-After`). En milisegundos.
   */
  retryAfterMs?: number;
  cause?: unknown;
  message: string;
}

/**
 * Error estructurado de un proveedor de visión.
 *
 * Permite que el dispatcher decida si vale la pena reintentar con el mismo
 * proveedor o hacer fallback al otro (`retryable=true`), o si es un error
 * fatal del lado del cliente (clave inválida, request mal formado, imagen
 * inválida, etc).
 */
export class VisionProviderError extends Error {
  readonly provider: VisionProvider;
  readonly kind: VisionErrorKind;
  readonly status?: number;
  readonly code?: string;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;

  constructor(init: VisionProviderErrorInit) {
    super(init.message);
    this.name = "VisionProviderError";
    this.provider = init.provider;
    this.kind = init.kind;
    this.status = init.status;
    this.code = init.code;
    this.retryAfterMs = init.retryAfterMs;
    this.retryable =
      init.retryable ??
      isRetryable({ kind: init.kind, status: init.status, code: init.code });
    if (init.cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = init.cause;
    }
  }
}

/**
 * Parsea el header `Retry-After` de una respuesta HTTP. Acepta segundos
 * (formato `delta-seconds`) o una fecha HTTP. Devuelve milisegundos o
 * `undefined` si no se puede interpretar.
 */
export function parseRetryAfterMs(
  header: string | null | undefined
): number | undefined {
  if (!header) return undefined;
  const trimmed = header.trim();
  if (!trimmed) return undefined;
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber) && asNumber >= 0) {
    return Math.round(asNumber * 1000);
  }
  const asDate = Date.parse(trimmed);
  if (Number.isFinite(asDate)) {
    const delta = asDate - Date.now();
    return delta > 0 ? delta : 0;
  }
  return undefined;
}

function isRetryable(opts: {
  kind: VisionErrorKind;
  status?: number;
  code?: string;
}): boolean {
  if (opts.kind === "network") return true;
  if (opts.kind === "empty") return true;
  if (opts.kind === "auth" || opts.kind === "config" || opts.kind === "parse") {
    return false;
  }
  if (opts.status !== undefined && RETRYABLE_HTTP_STATUS.has(opts.status)) {
    return true;
  }
  if (opts.code && RETRYABLE_GOOGLE_CODES.has(opts.code.toUpperCase())) {
    return true;
  }
  return false;
}

/**
 * Heurística para mapear un status HTTP a `kind`.
 * 401/403 → auth (no fallback, mismo error con el otro proveedor probablemente
 * no, pero la causa es de configuración del primario).
 * 400 → http fatal (request inválido, problema de imagen / payload).
 */
export function kindFromStatus(status: number): VisionErrorKind {
  if (status === 401 || status === 403) return "auth";
  return "http";
}
