import "server-only";
import type { VisionProvider } from "./types";

export function isQwenConfigured(): boolean {
  return !!process.env.QWEN_API_KEY;
}

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

export function isVisionConfigured(): boolean {
  return isQwenConfigured() || isGeminiConfigured();
}

/**
 * Determina el proveedor de visión activo. Prioridad:
 * 1) VISION_PROVIDER (`qwen` | `gemini`).
 * 2) Si solo hay GEMINI_API_KEY → gemini.
 * 3) Si solo hay QWEN_API_KEY → qwen.
 * 4) Si hay ambas, gana qwen (compat hacia atrás).
 */
export function resolveVisionProvider(): VisionProvider | null {
  const explicit = (process.env.VISION_PROVIDER ?? "").toLowerCase().trim();
  if (explicit === "qwen") {
    return isQwenConfigured() ? "qwen" : null;
  }
  if (explicit === "gemini") {
    return isGeminiConfigured() ? "gemini" : null;
  }
  if (isQwenConfigured()) return "qwen";
  if (isGeminiConfigured()) return "gemini";
  return null;
}

/**
 * Si VISION_INCLUDE_BBOXES está en false / 0 / off / no, el modelo solo
 * devuelve `valor` por campo. Los bbox se rellenan con [0,0,0,0] y se podrán
 * marcar manualmente desde el admin.
 */
export function shouldRequestBboxes(): boolean {
  const v = (process.env.VISION_INCLUDE_BBOXES ?? "").toLowerCase().trim();
  if (v === "false" || v === "0" || v === "off" || v === "no") return false;
  return true;
}

export function parseOptionalPositiveInt(
  value: string | undefined
): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function parseOptionalBoolean(
  value: string | undefined
): boolean | undefined {
  if (value === undefined || value === "") return undefined;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}
