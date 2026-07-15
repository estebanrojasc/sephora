import type { Record } from "@/features/records/types";

/**
 * Registro creado desde bitácora sin fotos (datos del Excel o ingreso manual).
 * Sigue siendo un registro válido en Guardados aunque no tenga imágenes.
 */
export function isAdminBitacoraRecord(record: Record): boolean {
  return record.deviceId === "admin-bitacora";
}
