import type { Extraction, Record } from "@/features/records/types";

/**
 * Nombre de conductor para mostrar en listados y cabecera del panel de revisión.
 * Prioriza el valor editado/detectado en la extracción sobre el nombre del
 * dispositivo al momento del upload (ej. "Conductor Demo").
 */
export function getRecordConductorLabel(
  record: Pick<Record, "driverName" | "extraction">,
  liveExtraction?: Extraction | null
): string {
  const fromLive = liveExtraction?.conductor?.valor?.trim();
  if (fromLive) return fromLive;

  const fromSaved = record.extraction?.conductor?.valor?.trim();
  if (fromSaved) return fromSaved;

  return record.driverName?.trim() || "—";
}
