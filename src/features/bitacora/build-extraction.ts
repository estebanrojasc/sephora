import {
  createEmptyExtraction,
  type Extraction,
  type Record,
} from "@/features/records/types";
import { formatChileanDate } from "@/lib/date-utils";
import type { BitacoraRow } from "./types";

const EMPTY_BBOX = [0, 0, 0, 0] as const;

function field(valor: string) {
  return { valor, bbox: [...EMPTY_BBOX] as [number, number, number, number] };
}

export function buildExtractionFromBitacoraRow(
  row: BitacoraRow,
  bitacoraDate: string
): Extraction {
  const base = createEmptyExtraction();
  const fechaDisplay = bitacoraDate
    ? formatChileanDate(bitacoraDate)
    : row.scheduledDate
      ? formatChileanDate(row.scheduledDate)
      : "";

  const obsParts: string[] = [];
  if (row.manualSubtype) obsParts.push(row.manualSubtype.replace(/_/g, " "));
  if (row.observacion) obsParts.push(row.observacion);
  if (row.sector) obsParts.push(`Sector: ${row.sector}`);
  if (row.territorio) obsParts.push(`Territorio: ${row.territorio}`);

  return {
    ...base,
    fecha: field(fechaDisplay),
    conductor: field(row.conductor ?? ""),
    auxiliar: field(row.auxiliar ?? ""),
    n_recorrido: field(row.recorridoSuffix ?? row.recorrido ?? ""),
    patente: field(row.patente ?? ""),
    cant_fact: field(row.cantFact ?? ""),
    valor_total: field(row.montoTotal ?? ""),
    observaciones: field(obsParts.join(" · ")),
  };
}

export function buildAdminRecordFromBitacora(
  row: BitacoraRow,
  bitacoraDate: string
): Omit<Record, "id" | "createdAt" | "updatedAt"> {
  return {
    deviceId: "admin-bitacora",
    driverId: "admin-bitacora",
    driverName: row.conductor?.trim() || "Bitácora",
    status: "in_review",
    images: [],
    extraction: buildExtractionFromBitacoraRow(row, bitacoraDate),
    attemptCount: 0,
  };
}
