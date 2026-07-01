import type { Record } from "@/features/records/types";

/**
 * Proyección mínima para listados: solo campos que usa la tabla admin / cards
 * del conductor. Evita bboxes, rendición, arrays de detalle e imágenes pesadas.
 */
export const LIST_RECORDS_PROJECTION = {
  _id: 0,
  id: 1,
  status: 1,
  createdAt: 1,
  updatedAt: 1,
  deviceId: 1,
  driverId: 1,
  driverName: 1,
  attemptCount: 1,
  reviewedBy: 1,
  "images.id": 1,
  "images.createdAt": 1,
  "images.processedAt": 1,
  "extraction.conductor.valor": 1,
  "extraction.n_recorrido.valor": 1,
  "extraction.patente.valor": 1,
  "extraction.auxiliar.valor": 1,
  "extraction.cant_fact.valor": 1,
  "extraction.valor_total.valor": 1,
  "extraction.fecha.valor": 1,
  "extraction._meta.bitacora": 1,
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
