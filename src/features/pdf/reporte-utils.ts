import {
  ensureExtractionShape,
  type Extraction,
  type ExtractedField,
  type Record,
} from "@/features/records/types";
import { formatExtractedDateChilean } from "@/lib/date-utils";
import {
  dedupeTransferenciaRows,
  harvestTransfersFromObservations,
} from "@/features/vision/normalize";

/**
 * Ajuste para registros viejos: si la extracción tiene transferencias
 * embebidas dentro de "observaciones" (porque se procesaron antes del
 * cambio de schema), las migra al vuelo a `detalle_transferencias`.
 *
 * No persiste nada: solo afecta cómo se muestra el reporte. La próxima
 * vez que el operador haga "Aplicar IA" la BD queda en el formato nuevo.
 */
export function migrateLegacyTransfers(extraction: Extraction): Extraction {
  const shaped = ensureExtractionShape(extraction);
  const obsValor = shaped.observaciones?.valor ?? "";
  if (!obsValor.trim()) return shaped;
  const harvested = harvestTransfersFromObservations(obsValor);
  if (harvested.rows.length === 0) return shaped;

  const merged = dedupeTransferenciaRows([
    ...shaped.detalle_transferencias,
    ...harvested.rows,
  ]);
  const observaciones: ExtractedField = {
    ...shaped.observaciones,
    valor: harvested.leftover,
  };
  return {
    ...shaped,
    detalle_transferencias: merged,
    observaciones,
  };
}

/**
 * Convierte un texto de monto a número. Acepta los formatos típicos que
 * escriben los conductores ("$120.000", "120,000", "$ 1.234.567", "1500").
 * Si no logra extraer dígitos, devuelve 0.
 */
export function parseAmount(value: string | undefined | null): number {
  if (!value) return 0;
  const digits = value.replace(/[^\d]/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

const FORMATTER = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export function formatearMoneda(value: number | undefined | null): string {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return FORMATTER.format(n);
}

export interface IncomeTotals {
  efectivo: number;
  chequesAlDia: number;
  chequesAFecha: number;
  creditoVendedor: number;
  rechazoTotal: number;
  rechazoParcial: number;
  ncNegocio: number;
  transferencias: number;
  total: number;
}

/**
 * Calcula los totales por categoría que se muestran en el panel "Resumen
 * de ingresos por categoría". Cuando el modelo entregó un total explícito,
 * lo usamos; si está vacío, lo derivamos sumando las filas del detalle.
 */
export function computeIncomeTotals(extraction: Extraction): IncomeTotals {
  const current = migrateLegacyTransfers(ensureExtractionShape(extraction));
  const sumNc = (rows: { valor: { valor: string } }[]) =>
    rows.reduce((acc, r) => acc + parseAmount(r.valor.valor), 0);

  const efectivoSumDetalle =
    current.detalle_efectivo.billetes.reduce(
      (acc, b) => acc + parseAmount(b.valor.valor),
      0
    ) +
    current.detalle_efectivo.monedas.reduce(
      (acc, b) => acc + parseAmount(b.valor.valor),
      0
    );
  const efectivoTotalCampo =
    parseAmount(current.detalle_efectivo.total_efectivo.valor) ||
    parseAmount(current.rendicion.efectivo_total.valor);
  const efectivo = efectivoTotalCampo || efectivoSumDetalle;

  const chequesAlDia = parseAmount(current.rendicion.cheques_al_dia.valor);
  const chequesAFecha = parseAmount(current.rendicion.cheques_a_fecha.valor);
  const creditoVendedor = parseAmount(
    current.rendicion.credito_vendedor.valor
  );

  const rechazoTotal =
    parseAmount(current.total_n_c_rechazo_total.valor) ||
    parseAmount(current.rendicion.retorno_total.valor) ||
    sumNc(current.n_c_rechazo_total);
  const rechazoParcial =
    parseAmount(current.total_n_c_rechazo_parcial.valor) ||
    parseAmount(current.rendicion.retorno_parcial.valor) ||
    sumNc(current.n_c_rechazo_parcial);
  const ncNegocio =
    parseAmount(current.total_n_c_por_negocios.valor) ||
    sumNc(current.n_c_por_negocios);
  const transferencias =
    parseAmount(current.total_transferencias.valor) ||
    sumNc(current.detalle_transferencias);

  const total =
    efectivo +
    chequesAlDia +
    chequesAFecha +
    creditoVendedor +
    rechazoTotal +
    rechazoParcial +
    ncNegocio +
    transferencias;

  return {
    efectivo,
    chequesAlDia,
    chequesAFecha,
    creditoVendedor,
    rechazoTotal,
    rechazoParcial,
    ncNegocio,
    transferencias,
    total,
  };
}

export type DetailCategoryId =
  | "cheques"
  | "chequesAFecha"
  | "rechazoTotal"
  | "rechazoParcial"
  | "creditoVendedor"
  | "ncNegocio"
  | "efectivo"
  | "transferencias";

export interface CashItem {
  denominacion: string;
  cantidad: number;
  valor: number;
  /** Distingue billetes de monedas en el reporte. */
  tipo?: "billete" | "moneda";
}

export interface RowItem {
  /** Texto principal de la fila (fecha, "Fact. 12345", etc.). */
  descripcion: string;
  /** Banco (cheques / transferencias). */
  banco?: string;
  /** Cliente (transferencias / crédito vendedor). */
  cliente?: string;
  /** N° vendedor (crédito vendedor). */
  vendedor?: string;
  /** Monto en pesos. */
  monto: number;
}

export interface DetailItems {
  items: CashItem[] | RowItem[];
  total: number;
}

/**
 * Devuelve las filas de detalle por categoría, listas para pintar en el
 * reporte. La lógica deduplica el caso "el modelo entregó total explícito"
 * versus "lo derivamos sumando filas".
 */
export function getDetailItems(
  extraction: Extraction,
  catId: DetailCategoryId
): DetailItems {
  const current = migrateLegacyTransfers(ensureExtractionShape(extraction));

  switch (catId) {
    case "cheques": {
      // Mientras la IA no separe "al día" vs "a fecha" por cheque, mostramos
      // TODOS los cheques bajo "Cheques al día". El bloque "chequesAFecha"
      // solo aporta el subtotal cuando existe.
      const items: RowItem[] = current.detalles_cheques.map((c) => ({
        descripcion: c.fecha.valor || "—",
        banco: c.banco.valor,
        monto: parseAmount(c.valor.valor),
      }));
      const total =
        parseAmount(current.rendicion.cheques_al_dia.valor) ||
        parseAmount(current.total_cheques.valor) ||
        items.reduce((acc, r) => acc + r.monto, 0);
      return { items, total };
    }
    case "chequesAFecha": {
      const total = parseAmount(current.rendicion.cheques_a_fecha.valor);
      // Sin items individuales (la IA mete todos los cheques en un solo array).
      // Solo se muestra el subtotal si hay valor.
      return { items: [], total };
    }
    case "rechazoTotal": {
      const items: RowItem[] = current.n_c_rechazo_total.map((r) => ({
        descripcion: r.no_fac.valor ? `Fact. ${r.no_fac.valor}` : "—",
        monto: parseAmount(r.valor.valor),
      }));
      const total =
        parseAmount(current.total_n_c_rechazo_total.valor) ||
        parseAmount(current.rendicion.retorno_total.valor) ||
        items.reduce((acc, r) => acc + r.monto, 0);
      return { items, total };
    }
    case "rechazoParcial": {
      const items: RowItem[] = current.n_c_rechazo_parcial.map((r) => ({
        descripcion: r.no_fac.valor ? `Fact. ${r.no_fac.valor}` : "—",
        monto: parseAmount(r.valor.valor),
      }));
      const total =
        parseAmount(current.total_n_c_rechazo_parcial.valor) ||
        parseAmount(current.rendicion.retorno_parcial.valor) ||
        items.reduce((acc, r) => acc + r.monto, 0);
      return { items, total };
    }
    case "ncNegocio": {
      const items: RowItem[] = current.n_c_por_negocios.map((r) => ({
        descripcion: r.no_fac.valor ? `Fact. ${r.no_fac.valor}` : "—",
        monto: parseAmount(r.valor.valor),
      }));
      const total =
        parseAmount(current.total_n_c_por_negocios.valor) ||
        items.reduce((acc, r) => acc + r.monto, 0);
      return { items, total };
    }
    case "creditoVendedor": {
      const items: RowItem[] = current.detalle_credito_vendedor.map((r) => ({
        descripcion: r.no_fac.valor ? `Fact. ${r.no_fac.valor}` : "—",
        cliente: r.cliente.valor,
        vendedor: r.nro_vendedor.valor,
        monto: parseAmount(r.valor.valor),
      }));
      const total =
        parseAmount(current.rendicion.credito_vendedor.valor) ||
        items.reduce((acc, r) => acc + r.monto, 0);
      return { items, total };
    }
    case "efectivo": {
      const mapCash = (
        rows: typeof current.detalle_efectivo.billetes,
        tipo: "billete" | "moneda"
      ): CashItem[] =>
        rows.map((b) => {
          const denomNum = parseAmount(b.denominacion.valor);
          const valorNum = parseAmount(b.valor.valor);
          const cantidad =
            denomNum > 0 ? Math.max(1, Math.round(valorNum / denomNum)) : 0;
          return {
            denominacion: b.denominacion.valor || "—",
            cantidad,
            valor: valorNum,
            tipo,
          };
        });

      const billetes = mapCash(current.detalle_efectivo.billetes, "billete");
      const monedas = mapCash(current.detalle_efectivo.monedas, "moneda");
      const items: CashItem[] = [...billetes, ...monedas];
      const total =
        parseAmount(current.detalle_efectivo.total_efectivo.valor) ||
        parseAmount(current.rendicion.efectivo_total.valor) ||
        items.reduce((acc, r) => acc + r.valor, 0);
      return { items, total };
    }
    case "transferencias": {
      const items: RowItem[] = current.detalle_transferencias.map((r) => ({
        descripcion: r.no_fac.valor ? `Fact. ${r.no_fac.valor}` : "—",
        cliente: r.cliente.valor,
        banco: r.banco.valor,
        monto: parseAmount(r.valor.valor),
      }));
      const total =
        parseAmount(current.total_transferencias.valor) ||
        items.reduce((acc, r) => acc + r.monto, 0);
      return { items, total };
    }
  }
}

/** Datos derivados de cabecera para el reporte. */
export interface HeaderData {
  fechaCreacion: string;
  fechaDocumento: string;
  conductor: string;
  auxiliar: string;
  numeroRecorrido: string;
  patente: string;
  cantidadFacturas: string;
  totalEsperadoRuta: number;
  /** ID del registro */
  registroId: string;
  /** Nombre del archivo sugerido para imprimir/descargar */
  nombreArchivoBase: string;
}

function formatCreatedAtChile(isoDate: string | undefined | null): string {
  if (!isoDate) return "—";
  const d = new Date(isoDate);
  return d.toLocaleDateString("es-CL", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function buildHeaderData(record: Record): HeaderData {
  const e = record.extraction;
  const fechaCreacion = formatCreatedAtChile(record.createdAt);

  const fechaDocumento = e?.fecha?.valor
    ? formatExtractedDateChilean(e.fecha.valor)
    : "—";

  const numeroRecorrido = e?.n_recorrido?.valor || "—";
  const conductor = e?.conductor?.valor?.trim() || "—";
  const auxiliar = e?.auxiliar?.valor || "—";
  const patente = e?.patente?.valor || "—";
  const cantidadFacturas = e?.cant_fact?.valor || "—";
  const totalEsperadoRuta = parseAmount(e?.valor_total?.valor);

  // Nombre tipo DDMMAA_<id>_<rec>_reporte-ejecutivo
  const fechaForName = (record.createdAt
    ? new Date(record.createdAt)
    : new Date()
  ).toLocaleDateString("en-CA", { timeZone: "America/Santiago" });
  const [y, m, day] = fechaForName.split("-");
  const stamp = `${day}${m}${y.slice(-2)}`;
  const recSan = numeroRecorrido.replace(/\s/g, "") || "N";
  const idSan = record.id.slice(0, 8);
  const nombreArchivoBase = `${stamp}_${idSan}_${recSan}_reporte-ejecutivo`;

  return {
    fechaCreacion,
    fechaDocumento,
    conductor,
    auxiliar,
    numeroRecorrido,
    patente,
    cantidadFacturas,
    totalEsperadoRuta,
    registroId: record.id,
    nombreArchivoBase,
  };
}
