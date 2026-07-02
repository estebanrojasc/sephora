/**
 * Genera template-bytes.ts con la plantilla embebida (siempre disponible en producción).
 * Se ejecuta en prebuild/predev.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const SOURCE = "templates/RUTA CFT-ABL -2026.xlsx";
const OUT = "src/features/excel/template-bytes.ts";

const buf = readFileSync(SOURCE);
const b64 = buf.toString("base64");
const sha256 = createHash("sha256").update(buf).digest("hex");

writeFileSync(
  OUT,
  `/** Auto-generado desde ${SOURCE} — no editar a mano. */
export const RENDICION_TEMPLATE_SHA256 = "${sha256}";
export const RENDICION_TEMPLATE_BYTE_LENGTH = ${buf.byteLength};
export const RENDICION_TEMPLATE_BASE64 = ${JSON.stringify(b64)};
`
);

console.log(`Embedded ${SOURCE} → ${OUT} (${buf.byteLength} bytes, sha256=${sha256.slice(0, 12)}…)`);
