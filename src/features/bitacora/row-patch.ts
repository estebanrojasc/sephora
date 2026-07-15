import type { BitacoraRow } from "@/features/bitacora/types";

/** Campos de datos editables en cualquier fila de bitácora (versión activa). */
export const BITACORA_ROW_EDITABLE_FIELDS = [
  "rowType",
  "manualSubtype",
  "scheduledDate",
  "territorio",
  "anden",
  "patente",
  "conductor",
  "auxiliar",
  "observacion",
  "sector",
  "recorrido",
  "recorridoSuffix",
  "primerFolio",
  "ultimoFolio",
  "cantFact",
  "puntos",
  "montoTotal",
] as const satisfies readonly (keyof BitacoraRow)[];

/** @deprecated Usar BITACORA_ROW_EDITABLE_FIELDS; se mantiene por compat. */
export const PENDING_DELIVERY_EDITABLE_FIELDS = [
  "scheduledDate",
  "territorio",
  "anden",
  "patente",
  "conductor",
  "auxiliar",
  "observacion",
  "sector",
  "recorrido",
  "recorridoSuffix",
  "primerFolio",
  "ultimoFolio",
  "cantFact",
  "puntos",
  "montoTotal",
] as const satisfies readonly (keyof BitacoraRow)[];

export type PendingDeliveryRowPatch = Partial<
  Pick<BitacoraRow, (typeof PENDING_DELIVERY_EDITABLE_FIELDS)[number]>
>;

export type BitacoraRowPatch = Partial<
  Pick<BitacoraRow, (typeof BITACORA_ROW_EDITABLE_FIELDS)[number]>
> & {
  allowsMultipleReviews?: boolean;
};

export function pickPendingDeliveryPatch(
  row: BitacoraRow
): PendingDeliveryRowPatch {
  const patch: PendingDeliveryRowPatch = {};
  for (const key of PENDING_DELIVERY_EDITABLE_FIELDS) {
    const value = row[key];
    if (value !== undefined) {
      (patch as Record<string, string | undefined>)[key] = value as string;
    }
  }
  return patch;
}
