import {
  createEmptyExtraction,
  type Extraction,
  type Record,
} from "@/features/records/types";
import { formatChileanDate } from "@/lib/date-utils";
import { buildBitacoraMetaBlock, bitacoraRecorridoCanonical } from "./meta";
import type { Bitacora, BitacoraRow } from "./types";

const EMPTY_BBOX = [0, 0, 0, 0] as const;

function field(valor: string) {
  return { valor, bbox: [...EMPTY_BBOX] as [number, number, number, number] };
}

export function buildExtractionFromBitacoraRow(
  row: BitacoraRow,
  bitacoraDate: string,
  bitacora?: Bitacora
): Extraction {
  const base = createEmptyExtraction();
  const fechaIso =
    row.rowType === "entrega_pendiente" && row.scheduledDate
      ? row.scheduledDate
      : bitacoraDate;
  const fechaDisplay = fechaIso
    ? formatChileanDate(fechaIso)
    : row.scheduledDate
      ? formatChileanDate(row.scheduledDate)
      : "";

  const obsParts: string[] = [];
  if (row.manualSubtype) obsParts.push(row.manualSubtype.replace(/_/g, " "));
  if (row.observacion) obsParts.push(row.observacion);
  if (row.sector) obsParts.push(`Sector: ${row.sector}`);
  if (row.territorio) obsParts.push(`Territorio: ${row.territorio}`);

  const extraction: Extraction = {
    ...base,
    fecha: field(fechaDisplay),
    conductor: field(row.conductor ?? ""),
    auxiliar: field(row.auxiliar ?? ""),
    n_recorrido: field(bitacoraRecorridoCanonical(row) ?? ""),
    patente: field(row.patente ?? ""),
    cant_fact: field(row.cantFact ?? ""),
    valor_total: field(row.montoTotal ?? ""),
    observaciones: field(obsParts.join(" · ")),
  };

  if (bitacora) {
    extraction._meta = {
      confidence: 1,
      processedImageIds: [],
      processedAt: new Date().toISOString(),
      source: "mock",
      bitacora: buildBitacoraMetaBlock(bitacora, row, 100, extraction),
    };
  }

  return extraction;
}

export function buildAdminRecordFromBitacora(
  row: BitacoraRow,
  bitacoraDate: string,
  bitacora?: Bitacora
): Omit<Record, "id" | "createdAt" | "updatedAt"> {
  return {
    deviceId: "admin-bitacora",
    driverId: "admin-bitacora",
    driverName: row.conductor?.trim() || "Bitácora",
    status: "in_review",
    images: [],
    extraction: buildExtractionFromBitacoraRow(row, bitacoraDate, bitacora),
    attemptCount: 0,
  };
}
