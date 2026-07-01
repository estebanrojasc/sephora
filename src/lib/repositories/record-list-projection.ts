import type { Record } from "@/features/records/types";

/**
 * Proyección Mongo para listados admin: sin imágenes base64 ni detalle de
 * extracción. Un registro completo puede pesar ~1.7 MB; la lista solo necesita
 * metadatos para la tabla.
 */
export const LIST_RECORDS_PROJECTION = {
  _id: 0,
  "images.url": 0,
  "images.processedUrl": 0,
  "extraction._meta.lastRawResponse": 0,
  "extraction._meta.processedImageIds": 0,
  "extraction.detalles_cheques": 0,
  "extraction.n_c_rechazo_total": 0,
  "extraction.n_c_rechazo_parcial": 0,
  "extraction.n_c_por_negocios": 0,
  "extraction.detalle_transferencias": 0,
  "extraction.detalle_credito_vendedor": 0,
  "extraction.detalle_efectivo": 0,
  "extraction.observaciones": 0,
  "extraction.total_n_c_rechazo_total": 0,
  "extraction.total_n_c_rechazo_parcial": 0,
  "extraction.total_n_c_por_negocios": 0,
  "extraction.total_transferencias": 0,
  "extraction.total_cheques": 0,
  "extraction.numero_deposito_en_efectivo": 0,
  "extraction.monto_deposito_en_efectivo": 0,
  "extraction.rendicion": 0,
} as const;

/** Rellena campos omitidos por la proyección para cumplir el tipo Record. */
export function normalizeListRecord(doc: Record): Record {
  return {
    ...doc,
    images: (doc.images ?? []).map((img) => ({
      id: img.id,
      url: "",
      createdAt: img.createdAt,
      processedAt: img.processedAt,
    })),
  };
}
