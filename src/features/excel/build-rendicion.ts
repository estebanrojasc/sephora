import {
  ensureExtractionShape,
  type Extraction,
  type Record as AppRecord,
} from "@/features/records/types";
import { migrateLegacyTransfers } from "@/features/pdf/reporte-utils";
import { buildExtractionScalars } from "./build-extraction-scalars";

export interface ScalarValue {
  value: string;
  numeric: boolean;
}

export interface ChequeRow {
  fecha: string;
  banco: string;
  valor: string;
}

export interface NcRow {
  fac: string;
  val: string;
}

export interface BilleteListRow {
  denom: string;
  valor: string;
}

/** Fila del cuadro inferior (crédito vendedor / transferencias). */
export interface DetalleTablaRow {
  cliente: string;
  no_fac: string;
  valor: string;
  nro_vendedor?: string;
  banco?: string;
  /** Solo se rellena en la primera fila del bloque de transferencias. */
  recorrido?: string;
}

export interface RendicionLists {
  cheques: ChequeRow[];
  rech_total: NcRow[];
  rech_parcial: NcRow[];
  negocio: NcRow[];
  credito_vendedor: DetalleTablaRow[];
  transferencias: DetalleTablaRow[];
  billetes: BilleteListRow[];
  monedas: BilleteListRow[];
}

export interface RendicionPayload {
  scalars: globalThis.Record<string, ScalarValue>;
  lists: RendicionLists;
}

function getExtraction(record: AppRecord): Extraction | null {
  return record.extraction
    ? migrateLegacyTransfers(ensureExtractionShape(record.extraction))
    : null;
}

function text(value: { valor: string } | undefined): string {
  return value?.valor ?? "";
}

export function buildRendicionPayload(record: AppRecord): RendicionPayload {
  const e = getExtraction(record);

  const empty: RendicionPayload = {
    scalars: {},
    lists: {
      cheques: [],
      rech_total: [],
      rech_parcial: [],
      negocio: [],
      credito_vendedor: [],
      transferencias: [],
      billetes: [],
      monedas: [],
    },
  };

  if (!e) return empty;

  const scalars = buildExtractionScalars(e);

  const lists: RendicionLists = {
    cheques: (e.detalles_cheques ?? []).map((c) => ({
      fecha: text(c.fecha),
      banco: text(c.banco),
      valor: text(c.valor),
    })),
    rech_total: (e.n_c_rechazo_total ?? []).map((r) => ({
      fac: text(r.no_fac),
      val: text(r.valor),
    })),
    rech_parcial: (e.n_c_rechazo_parcial ?? []).map((r) => ({
      fac: text(r.no_fac),
      val: text(r.valor),
    })),
    negocio: (e.n_c_por_negocios ?? []).map((r) => ({
      fac: text(r.no_fac),
      val: text(r.valor),
    })),
    credito_vendedor: (e.detalle_credito_vendedor ?? []).map((r) => ({
      cliente: text(r.cliente),
      no_fac: text(r.no_fac),
      valor: text(r.valor),
      nro_vendedor: text(r.nro_vendedor),
    })),
    transferencias: (e.detalle_transferencias ?? []).map((r, i) => ({
      cliente: text(r.cliente),
      no_fac: text(r.no_fac),
      valor: text(r.valor),
      banco: text(r.banco),
      ...(i === 0 ? { recorrido: text(e.n_recorrido) } : {}),
    })),
    billetes: (e.detalle_efectivo.billetes ?? []).map((r) => ({
      denom: text(r.denominacion),
      valor: text(r.valor),
    })),
    monedas: (e.detalle_efectivo.monedas ?? []).map((r) => ({
      denom: text(r.denominacion),
      valor: text(r.valor),
    })),
  };

  return { scalars, lists };
}

function formatDateForFilename(isoDate: string | undefined): string {
  const date = isoDate ? new Date(isoDate) : new Date();
  const parts = date
    .toLocaleDateString("en-CA", { timeZone: "America/Santiago" })
    .split("-");
  const [year, month, day] = parts;
  return `${day ?? "00"}${month ?? "00"}${year?.slice(-2) ?? "00"}`;
}

function sanitizeFilenamePart(value: string): string {
  const sanitized = value.trim().replace(/[^\w.-]+/g, "");
  return sanitized || "N";
}

export function buildRendicionExcelFilename(record: AppRecord): string {
  const e = getExtraction(record);
  const stamp = formatDateForFilename(record.createdAt);
  const rec = sanitizeFilenamePart(text(e?.n_recorrido));
  const id = sanitizeFilenamePart(record.id.slice(0, 8));
  return `${stamp}_${id}_${rec}_rendicion.xlsx`;
}
