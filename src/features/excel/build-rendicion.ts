import {
  ensureExtractionShape,
  type Extraction,
  type Record as AppRecord,
} from "@/features/records/types";
import { migrateLegacyTransfers } from "@/features/pdf/reporte-utils";

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

  const scalars: globalThis.Record<string, ScalarValue> = {
    "{{extraction.fecha.valor}}": { value: text(e.fecha), numeric: false },
    "{{extraction.auxiliar.valor}}": { value: text(e.auxiliar), numeric: false },
    "{{extraction.conductor.valor}}": { value: text(e.conductor), numeric: false },
    "{{extraction.n_recorrido.valor}}": { value: text(e.n_recorrido), numeric: false },
    "{{extraction.cant_fact.valor}}": { value: text(e.cant_fact), numeric: true },
    "{{extraction.valor_total.valor}}": { value: text(e.valor_total), numeric: true },
    "{{extraction.rendicion.efectivo_total.valor}}": {
      value: text(e.rendicion.efectivo_total),
      numeric: true,
    },
    "{{extraction.detalle_efectivo.total_billetes.valor}}": {
      value: text(e.detalle_efectivo.total_billetes),
      numeric: true,
    },
    "{{extraction.detalle_efectivo.total_monedas.valor}}": {
      value: text(e.detalle_efectivo.total_monedas),
      numeric: true,
    },
    "{{extraction.detalle_efectivo.total_efectivo.valor}}": {
      value: text(e.detalle_efectivo.total_efectivo),
      numeric: true,
    },
    "{{extraction.rendicion.cheques_al_dia.valor}}": {
      value: text(e.rendicion.cheques_al_dia),
      numeric: true,
    },
    "{{extraction.rendicion.cheques_a_fecha.valor}}": {
      value: text(e.rendicion.cheques_a_fecha),
      numeric: true,
    },
    "{{extraction.rendicion.credito_vendedor.valor}}": {
      value: text(e.rendicion.credito_vendedor),
      numeric: true,
    },
    "{{extraction.rendicion.retorno_total.valor}}": {
      value: text(e.rendicion.retorno_total),
      numeric: true,
    },
    "{{extraction.rendicion.retorno_parcial.valor}}": {
      value: text(e.rendicion.retorno_parcial),
      numeric: true,
    },
    "{{extraction.rendicion.n_c_negocio.valor}}": {
      value: text(e.rendicion.n_c_negocio),
      numeric: true,
    },
    "{{extraction.rendicion.transferencia.valor}}": {
      value: text(e.rendicion.transferencia),
      numeric: true,
    },
    "{{extraction.rendicion.total.valor}}": {
      value: text(e.rendicion.total),
      numeric: true,
    },
    "{{extraction.total_n_c_rechazo_total.valor}}": {
      value: text(e.total_n_c_rechazo_total),
      numeric: true,
    },
    "{{extraction.total_n_c_rechazo_parcial.valor}}": {
      value: text(e.total_n_c_rechazo_parcial),
      numeric: true,
    },
    "{{extraction.total_n_c_por_negocios.valor}}": {
      value: text(e.total_n_c_por_negocios),
      numeric: true,
    },
  };

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
