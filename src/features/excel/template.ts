import { createHash } from "node:crypto";
import {
  RENDICION_TEMPLATE_BASE64,
  RENDICION_TEMPLATE_BYTE_LENGTH,
  RENDICION_TEMPLATE_SHA256,
} from "./template-bytes";

let cachedTemplate: Uint8Array | null = null;

/** SHA256 de la plantilla embebida (verificación en headers de export). */
export function rendicionTemplateSha256(): string {
  return RENDICION_TEMPLATE_SHA256;
}

/**
 * Carga la plantilla RUTA CFT-ABL -2026.xlsx embebida en el bundle.
 * No depende del filesystem — funciona en Railway/Vercel/Docker.
 */
export function loadRendicionTemplate(): Uint8Array {
  if (cachedTemplate) return cachedTemplate;

  const bytes = Buffer.from(RENDICION_TEMPLATE_BASE64, "base64");
  if (bytes.byteLength !== RENDICION_TEMPLATE_BYTE_LENGTH) {
    throw new Error(
      `Plantilla embebida corrupta (${bytes.byteLength} bytes, esperados ${RENDICION_TEMPLATE_BYTE_LENGTH})`
    );
  }

  const sha = createHash("sha256").update(bytes).digest("hex");
  if (sha !== RENDICION_TEMPLATE_SHA256) {
    throw new Error("Plantilla embebida: checksum SHA256 no coincide");
  }

  cachedTemplate = new Uint8Array(bytes);
  return cachedTemplate;
}
