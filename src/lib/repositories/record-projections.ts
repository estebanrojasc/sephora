import type { Record } from "@/features/records/types";

/** Respuesta JSON de Gemini guardada en _meta; puede pesar cientos de KB. */
export const EXCLUDE_RAW_AI_RESPONSE = {
  "extraction._meta.lastRawResponse": 0,
} as const;

/** Panel de revisión: sin processedUrl ni respuesta cruda de IA. */
export const RECORD_DETAIL_PROJECTION = {
  _id: 0,
  "images.processedUrl": 0,
  ...EXCLUDE_RAW_AI_RESPONSE,
} as const;

/** Excel (individual o consolidado): solo extracción, sin imágenes. */
export const EXCEL_RECORD_PROJECTION = {
  _id: 0,
  images: 0,
  ...EXCLUDE_RAW_AI_RESPONSE,
} as const;

export function normalizeExcelRecord(doc: Record): Record {
  return { ...doc, images: [] };
}
