import "server-only";
import {
  isGeminiConfigured,
  isQwenConfigured,
  isVisionConfigured,
  parseOptionalPositiveInt,
  resolveVisionProvider,
  shouldRequestBboxes,
} from "./config";
import { VisionProviderError } from "./errors";
import { extractWithGemini } from "./gemini";
import { extractWithQwen } from "./qwen";
import type {
  VisionExtractOptions,
  VisionExtractResult,
  VisionProvider,
} from "./types";

export {
  isGeminiConfigured,
  isQwenConfigured,
  isVisionConfigured,
  resolveVisionProvider,
  shouldRequestBboxes,
};
export { VisionProviderError } from "./errors";
export type { VisionExtractResult, VisionProvider };

/**
 * Cantidad de reintentos sobre el MISMO proveedor antes de hacer fallback al
 * otro. `1` ⇒ se intenta una segunda vez antes del fallback. Configurable con
 * `VISION_RETRY_COUNT`.
 */
const DEFAULT_RETRY_COUNT = 1;
/**
 * Espera base entre reintentos (ms). El backoff es exponencial: el intento N
 * espera `delay * 2^(N-1)`. Si el servidor manda `Retry-After`, se respeta
 * ese valor y se ignora el backoff. Configurable con `VISION_RETRY_DELAY_MS`.
 */
const DEFAULT_RETRY_DELAY_MS = 2000;
/** Tope de seguridad para no quedarse esperando un Retry-After absurdo. */
const MAX_RETRY_DELAY_MS = 30_000;

function getRetryCount(): number {
  return (
    parseOptionalPositiveInt(process.env.VISION_RETRY_COUNT) ??
    DEFAULT_RETRY_COUNT
  );
}

function getRetryDelayMs(): number {
  return (
    parseOptionalPositiveInt(process.env.VISION_RETRY_DELAY_MS) ??
    DEFAULT_RETRY_DELAY_MS
  );
}

function isProviderAvailable(provider: VisionProvider): boolean {
  return provider === "qwen" ? isQwenConfigured() : isGeminiConfigured();
}

function otherProvider(provider: VisionProvider): VisionProvider {
  return provider === "qwen" ? "gemini" : "qwen";
}

async function callProvider(
  provider: VisionProvider,
  opts: VisionExtractOptions
): Promise<VisionExtractResult> {
  return provider === "gemini"
    ? extractWithGemini(opts)
    : extractWithQwen(opts);
}

function describeError(error: unknown): string {
  if (error instanceof VisionProviderError) {
    return `${error.kind}${error.status ? ` ${error.status}` : ""}${error.code ? ` ${error.code}` : ""}`;
  }
  return "error";
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Llama al proveedor de visión activo según las variables de entorno.
 *
 * Política ante fallos transitorios (red, 429, 500/502/503/504, `UNAVAILABLE`,
 * `RESOURCE_EXHAUSTED`, etc.):
 *
 *   1. Reintenta sobre el MISMO proveedor hasta `VISION_RETRY_COUNT` veces
 *      (default 1), con backoff exponencial a partir de
 *      `VISION_RETRY_DELAY_MS` (default 2000ms). Si el servidor envía
 *      `Retry-After`, se respeta ese valor.
 *   2. Si tras los reintentos sigue fallando y el otro proveedor está
 *      configurado, hace fallback automático.
 *
 * Errores fatales (auth, 400, config, parse) NO disparan ni reintento ni
 * fallback.
 */
export async function extractWithVision(
  opts: Omit<VisionExtractOptions, "withBboxes" | "imageDataUrls"> & {
    withBboxes?: boolean;
    imageDataUrls?: string[];
    imageDataUrl?: string;
  }
): Promise<VisionExtractResult> {
  const primary = resolveVisionProvider();
  if (!primary) {
    throw new Error(
      "No hay proveedor de visión configurado. Define QWEN_API_KEY o GEMINI_API_KEY (y opcionalmente VISION_PROVIDER)."
    );
  }

  const withBboxes = opts.withBboxes ?? shouldRequestBboxes();
  const imageDataUrls =
    opts.imageDataUrls ?? (opts.imageDataUrl ? [opts.imageDataUrl] : []);

  if (imageDataUrls.length === 0) {
    throw new Error("Debes proveer al menos una imagen (imageDataUrls).");
  }

  const fullOpts: VisionExtractOptions = {
    imageDataUrls,
    previousExtraction: opts.previousExtraction,
    withBboxes,
  };

  const retryCount = getRetryCount();
  const baseDelayMs = getRetryDelayMs();

  // 1) Primario con reintentos.
  let lastPrimaryError: unknown;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      return await callProvider(primary, fullOpts);
    } catch (error) {
      lastPrimaryError = error;

      const isRetryable =
        error instanceof VisionProviderError && error.retryable;
      const hasMoreAttempts = attempt < retryCount;

      if (!isRetryable || !hasMoreAttempts) break;

      const expBackoff = baseDelayMs * Math.pow(2, attempt);
      const wait = Math.min(
        (error as VisionProviderError).retryAfterMs ?? expBackoff,
        MAX_RETRY_DELAY_MS
      );
      console.warn(
        `[vision] ${primary} falló (${describeError(error)}); reintento ${attempt + 1}/${retryCount} en ${wait}ms.`
      );
      await sleep(wait);
    }
  }

  // 2) Fallback al otro proveedor si procede.
  const fallback = otherProvider(primary);
  const canFallback =
    lastPrimaryError instanceof VisionProviderError &&
    lastPrimaryError.retryable &&
    isProviderAvailable(fallback);

  if (!canFallback) throw lastPrimaryError;

  console.warn(
    `[vision] ${primary} agotó reintentos (${describeError(lastPrimaryError)}); haciendo fallback a ${fallback}.`
  );

  try {
    return await callProvider(fallback, fullOpts);
  } catch (fallbackError) {
    const primaryMsg =
      lastPrimaryError instanceof Error
        ? lastPrimaryError.message
        : String(lastPrimaryError);
    const fallbackMsg =
      fallbackError instanceof Error
        ? fallbackError.message
        : String(fallbackError);
    console.error(
      `[vision] fallback a ${fallback} también falló. primario(${primary})=${primaryMsg} | fallback(${fallback})=${fallbackMsg}`
    );
    throw fallbackError;
  }
}
