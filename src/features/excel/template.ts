import { readFileSync } from "node:fs";
import path from "node:path";

const TEMPLATE_FILENAME = "RUTA CFT-ABL -2026.xlsx";
const MIN_TEMPLATE_BYTES = 10_000;

let cachedTemplate: Uint8Array | null = null;

export function rendicionTemplatePath(): string {
  return path.join(process.cwd(), "templates", TEMPLATE_FILENAME);
}

/** Carga la plantilla .xlsx (cache en memoria). Falla con mensaje claro si falta en el servidor. */
export function loadRendicionTemplate(): Uint8Array {
  if (cachedTemplate) return cachedTemplate;

  const templatePath = rendicionTemplatePath();
  let bytes: Buffer;
  try {
    bytes = readFileSync(templatePath);
  } catch {
    throw new Error(
      `No se encontró la plantilla Excel en ${templatePath}. Verifique el deploy (carpeta templates/).`
    );
  }

  if (bytes.byteLength < MIN_TEMPLATE_BYTES) {
    throw new Error(
      `Plantilla Excel inválida (${bytes.byteLength} bytes) en ${templatePath}`
    );
  }

  cachedTemplate = new Uint8Array(bytes);
  return cachedTemplate;
}
