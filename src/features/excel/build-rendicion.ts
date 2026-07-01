import {
  ensureExtractionShape,
  type Extraction,
  type Record as AppRecord,
} from "@/features/records/types";
import { splitChequesByTipo, chequeReferenceIso } from "@/features/records/cheque-utils";
import { syncBitacoraMetaInExtraction } from "@/features/bitacora/meta";
import { migrateLegacyTransfers } from "@/features/pdf/reporte-utils";
import { transferBankDisplayLabel } from "@/features/records/transfer-bank";
import { parseNumber } from "@/lib/parse-number";
import type { BitacoraExcelFields } from "@/features/bitacora/meta";

function appendResumenBitacoraScalars(
  scalars: globalThis.Record<string, ScalarValue>,
  e: Extraction,
  excel: BitacoraExcelFields | undefined
): void {
  const entries: [string, string | undefined, boolean][] = [
    ["{{extraction._meta.bitacora.excel.conductor}}", excel?.conductor ?? text(e.conductor), false],
    [
      "{{extraction._meta.bitacora.excel.conductor_inicial}}",
      excel?.conductor_inicial,
      false,
    ],
    ["{{extraction._meta.bitacora.excel.auxiliar}}", excel?.auxiliar ?? text(e.auxiliar), false],
    [
      "{{extraction._meta.bitacora.excel.observaciones}}",
      excel?.observaciones ?? text(e.observaciones),
      false,
    ],
    ["{{extraction._meta.bitacora.excel.sector}}", excel?.sector, false],
    [
      "{{extraction._meta.bitacora.excel.recorrido}}",
      excel?.recorrido ?? text(e.n_recorrido),
      false,
    ],
    [
      "{{extraction._meta.bitacora.excel.n_factura}}",
      excel?.n_factura ?? text(e.cant_fact),
      true,
    ],
    [
      "{{extraction._meta.bitacora.excel.total_factura}}",
      excel?.total_factura ?? text(e.valor_total),
      true,
    ],
    ["{{extraction._meta.bitacora.excel.patente}}", excel?.patente ?? text(e.patente), false],
  ];
  for (const [key, value, numeric] of entries) {
    scalars[key] = { value: value ?? "", numeric };
  }
}

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

/** Fila del cuadro inferior (crédito vendedor / transferencias). */
export interface DetalleTablaRow {
  cliente: string;
  no_fac: string;
  valor: string;
  nro_vendedor?: string;
  banco?: string;
  /** Recorrido en cada fila del bloque (crédito / transferencias). */
  recorrido?: string;
}

export interface RendicionLists {
  cheques_a_fecha: ChequeRow[];
  cheques_al_dia: ChequeRow[];
  rech_total: NcRow[];
  rech_parcial: NcRow[];
  negocio: NcRow[];
  credito_vendedor: DetalleTablaRow[];
  transferencias: DetalleTablaRow[];
}

export interface RendicionPayload {
  scalars: globalThis.Record<string, ScalarValue>;
  lists: RendicionLists;
}

function getExtraction(record: AppRecord): Extraction | null {
  if (!record.extraction) return null;
  return syncBitacoraMetaInExtraction(
    migrateLegacyTransfers(ensureExtractionShape(record.extraction))
  );
}

function text(value: { valor: string } | undefined): string {
  return value?.valor ?? "";
}

function aliasScalar(
  scalars: globalThis.Record<string, ScalarValue>,
  alias: string,
  canonical: string
): void {
  const target = scalars[canonical];
  if (target) scalars[alias] = { ...target };
}

export function buildRendicionPayload(record: AppRecord): RendicionPayload {
  const e = getExtraction(record);

  const empty: RendicionPayload = {
    scalars: {},
    lists: {
      cheques_a_fecha: [],
      cheques_al_dia: [],
      rech_total: [],
      rech_parcial: [],
      negocio: [],
      credito_vendedor: [],
      transferencias: [],
    },
  };

  if (!e) return empty;

  const scalars: globalThis.Record<string, ScalarValue> = {
    "{{extraction.fecha.valor}}": { value: text(e.fecha), numeric: false },
    "{{extraction.auxiliar.valor}}": { value: text(e.auxiliar), numeric: false },
    "{{extraction.conductor.valor}}": { value: text(e.conductor), numeric: false },
    "{{extraction.n_recorrido.valor}}": { value: text(e.n_recorrido), numeric: false },
    "{{extraction.patente.valor}}": { value: text(e.patente), numeric: false },
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
    "{{extraction.total_cheques.valor}}": {
      value: text(e.total_cheques),
      numeric: true,
    },
    "{{extraction.total_transferencias.valor}}": {
      value: text(e.total_transferencias),
      numeric: true,
    },
    "{{extraction.numero_deposito_en_efectivo.valor}}": {
      value: text(e.numero_deposito_en_efectivo),
      numeric: false,
    },
    "{{extraction.monto_deposito_en_efectivo.valor}}": {
      value: text(e.monto_deposito_en_efectivo),
      numeric: true,
    },
    "{{extraction.observaciones.valor}}": {
      value: text(e.observaciones),
      numeric: false,
    },
  };

  const bitExcel = e._meta?.bitacora?.excel;
  appendResumenBitacoraScalars(scalars, e, bitExcel);

  aliasScalar(
    scalars,
    "{{extraction.rendicion.detalles_cheques.total_billetes.valor}}",
    "{{extraction.detalle_efectivo.total_billetes.valor}}"
  );
  aliasScalar(
    scalars,
    "{{extraction.rendicion.detalles_cheques.total_monedas.valor}}",
    "{{extraction.detalle_efectivo.total_monedas.valor}}"
  );

  const { alDia, aFecha } = splitChequesByTipo(
    e.detalles_cheques ?? [],
    chequeReferenceIso(e)
  );
  const mapCheque = (c: (typeof e.detalles_cheques)[number]) => ({
    fecha: text(c.fecha),
    banco: text(c.banco),
    valor: text(c.valor),
  });

  const lists: RendicionLists = {
    cheques_a_fecha: aFecha.map(mapCheque),
    cheques_al_dia: alDia.map(mapCheque),
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
      recorrido: text(e.n_recorrido),
    })),
    transferencias: (e.detalle_transferencias ?? []).map((r) => ({
      cliente: text(r.cliente),
      no_fac: text(r.no_fac),
      valor: text(r.valor),
      banco: transferBankDisplayLabel(text(r.banco)),
      recorrido: text(e.n_recorrido),
    })),
  };

  return { scalars, lists };
}

/** Combina varios registros en un payload para la hoja Resumen consolidada. */
export function mergeRendicionPayloads(
  payloads: RendicionPayload[]
): RendicionPayload {
  const empty: RendicionPayload = {
    scalars: {},
    lists: {
      cheques_a_fecha: [],
      cheques_al_dia: [],
      rech_total: [],
      rech_parcial: [],
      negocio: [],
      credito_vendedor: [],
      transferencias: [],
    },
  };

  if (payloads.length === 0) return empty;
  if (payloads.length === 1) return payloads[0]!;

  const keys = new Set<string>();
  for (const p of payloads) {
    for (const k of Object.keys(p.scalars)) keys.add(k);
  }

  const scalars: globalThis.Record<string, ScalarValue> = {};
  for (const key of keys) {
    const values = payloads
      .map((p) => p.scalars[key])
      .filter((v): v is ScalarValue => v !== undefined);
    if (values.length === 0) continue;

    if (values[0]!.numeric) {
      let sum = 0;
      let any = false;
      for (const v of values) {
        if (!v.value.trim()) continue;
        const n = parseNumber(v.value);
        if (n !== null) {
          sum += n;
          any = true;
        }
      }
      scalars[key] = { value: any ? String(sum) : "", numeric: true };
    } else {
      const parts = [
        ...new Set(values.map((v) => v.value.trim()).filter(Boolean)),
      ];
      scalars[key] = {
        value: parts.length <= 1 ? (parts[0] ?? "") : "VARIOS",
        numeric: false,
      };
    }
  }

  const lists: RendicionLists = {
    cheques_a_fecha: payloads.flatMap((p) => p.lists.cheques_a_fecha),
    cheques_al_dia: payloads.flatMap((p) => p.lists.cheques_al_dia),
    rech_total: payloads.flatMap((p) => p.lists.rech_total),
    rech_parcial: payloads.flatMap((p) => p.lists.rech_parcial),
    negocio: payloads.flatMap((p) => p.lists.negocio),
    credito_vendedor: payloads.flatMap((p) => p.lists.credito_vendedor),
    transferencias: payloads.flatMap((p) => p.lists.transferencias),
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
