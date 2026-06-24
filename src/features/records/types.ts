import { splitBilletesAndMonedas } from "./efectivo-utils";

export type RecordStatus =
  | "uploaded"
  | "in_review"
  | "errors"
  | "saved"
  | "rejected";

export interface RecordImage {
  id: string;
  /**
   * URL/dataURL de la versión ORIGINAL (alta resolución).
   * Es la que ve el admin con zoom.
   */
  url: string;
  /**
   * URL/dataURL de la versión PROCESADA (menor resolución).
   * Es la que se envía al modelo cuando se procesa con IA.
   * Si no existe, se cae a `url`.
   */
  processedUrl?: string;
  createdAt: string;
  processedAt?: string;
}

export type Bbox = [number, number, number, number];

export interface ExtractedField {
  valor: string;
  bbox: Bbox;
  bboxSource?: "ai" | "manual";
  bboxCorrection?: {
    originalBbox: Bbox;
    correctedBbox: Bbox;
    delta: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      centerX: number;
      centerY: number;
    };
    correctedAt: string;
  };
}

export interface ChequeRow {
  fecha: ExtractedField;
  banco: ExtractedField;
  valor: ExtractedField;
}

export interface NCRow {
  no_fac: ExtractedField;
  valor: ExtractedField;
}

/** Fila de transferencia: factura, monto, cliente y banco (manual). */
export interface TransferenciaRow {
  no_fac: ExtractedField;
  valor: ExtractedField;
  cliente: ExtractedField;
  banco: ExtractedField;
}

/** Fila de crédito vendedor: factura, cliente, monto y número de vendedor. */
export interface CreditoVendedorRow {
  no_fac: ExtractedField;
  cliente: ExtractedField;
  valor: ExtractedField;
  nro_vendedor: ExtractedField;
}

export interface BilleteRow {
  denominacion: ExtractedField;
  valor: ExtractedField;
}

export interface ExtractedRendicion {
  efectivo_total: ExtractedField;
  cheques_al_dia: ExtractedField;
  cheques_a_fecha: ExtractedField;
  credito_vendedor: ExtractedField;
  retorno_total: ExtractedField;
  retorno_parcial: ExtractedField;
  n_c_negocio: ExtractedField;
  transferencia: ExtractedField;
  total: ExtractedField;
}

export interface ExtractedDetalleEfectivo {
  billetes: BilleteRow[];
  monedas: BilleteRow[];
  total_billetes: ExtractedField;
  total_monedas: ExtractedField;
  total_efectivo: ExtractedField;
}

export interface Extraction {
  fecha: ExtractedField;
  conductor: ExtractedField;
  auxiliar: ExtractedField;
  n_recorrido: ExtractedField;
  patente: ExtractedField;
  cant_fact: ExtractedField;
  valor_total: ExtractedField;
  rendicion: ExtractedRendicion;
  detalles_cheques: ChequeRow[];
  total_cheques: ExtractedField;
  n_c_rechazo_total: NCRow[];
  n_c_rechazo_parcial: NCRow[];
  n_c_por_negocios: NCRow[];
  /**
   * Detalle de transferencias escritas en la zona inferior del documento
   * (cuadro "observaciones"). Cada fila trae N° factura, cliente (si hay)
   * y monto.
   */
  detalle_transferencias: TransferenciaRow[];
  /** Detalle del cuadro de crédito vendedor (factura, cliente, monto, n° vendedor). */
  detalle_credito_vendedor: CreditoVendedorRow[];
  detalle_efectivo: ExtractedDetalleEfectivo;
  total_n_c_rechazo_total: ExtractedField;
  total_n_c_rechazo_parcial: ExtractedField;
  total_n_c_por_negocios: ExtractedField;
  total_transferencias: ExtractedField;
  numero_deposito_en_efectivo: ExtractedField;
  monto_deposito_en_efectivo: ExtractedField;
  observaciones: ExtractedField;

  /** Metadata interna (no enviada al modelo, gestionada por el backend). */
  _meta?: {
    confidence: number;
    processedImageIds: string[];
    processedAt: string;
    manualOverride?: boolean;
    source?: "qwen" | "gemini" | "mock";
    /** Último texto crudo devuelto por el modelo, para depuración. */
    lastRawResponse?: string;
    lastModel?: string;
    lastProvider?: "qwen" | "gemini" | "mock";
    /** Si el modelo devolvió bboxes en la última corrida. */
    lastWithBboxes?: boolean;
  };
}

export interface Record {
  id: string;
  deviceId: string;
  driverId: string;
  driverName: string;
  status: RecordStatus;
  createdAt: string;
  updatedAt: string;
  images: RecordImage[];
  extraction?: Extraction;
  errorComment?: string;
  previousStatus?: RecordStatus;
  /** ID del attempt de IA activo. Hay historial completo en colección aparte. */
  currentAttemptId?: string;
  /** Cuántas veces se ha ejecutado la IA contra este registro. */
  attemptCount?: number;
}

export interface UploadPayload {
  deviceId: string;
  driverId: string;
  driverName: string;
  images: {
    /** Versión original (alta resolución) para revisión visual. */
    dataUrl: string;
    /** Versión procesada para el modelo (opcional, default = dataUrl). */
    processedDataUrl?: string;
    name: string;
  }[];
}

export interface ProcessAIPayload {
  /**
   * IDs de imágenes a procesar. Si está vacío o no se pasa, se procesan
   * todas las imágenes del registro en una sola corrida.
   */
  imageIds?: string[];
  /** Si es true, ignora la extracción previa y arranca de cero. */
  reset?: boolean;
}

export interface UpdateStatusPayload {
  status: RecordStatus;
  errorComment?: string;
}

export type UpdateExtractionPayload = Partial<Extraction>;

export const EMPTY_FIELD: ExtractedField = { valor: "", bbox: [0, 0, 0, 0] };

function fillBilleteRow(row: Partial<BilleteRow>): BilleteRow {
  return {
    denominacion: row.denominacion ?? { ...EMPTY_FIELD },
    valor: row.valor ?? { ...EMPTY_FIELD },
  };
}

function normalizeDetalleEfectivo(
  raw: Partial<ExtractedDetalleEfectivo> | undefined
): ExtractedDetalleEfectivo {
  const base = createEmptyExtraction().detalle_efectivo;
  if (!raw) return base;

  let billetes = (raw.billetes ?? []).map((r) => fillBilleteRow(r));
  let monedas = (raw.monedas ?? []).map((r) => fillBilleteRow(r));

  if (monedas.length === 0 && billetes.length > 0) {
    const split = splitBilletesAndMonedas(billetes);
    billetes = split.billetes;
    monedas = split.monedas;
  }

  return {
    billetes,
    monedas,
    total_billetes: raw.total_billetes ?? { ...EMPTY_FIELD },
    total_monedas: raw.total_monedas ?? { ...EMPTY_FIELD },
    total_efectivo: raw.total_efectivo ?? { ...EMPTY_FIELD },
  };
}

/**
 * Garantiza que una extracción persistida (posiblemente de un schema anterior)
 * tenga todos los campos del schema actual con valores por defecto.
 */
export function ensureExtractionShape(
  extraction: Extraction | Partial<Extraction>
): Extraction {
  const base = createEmptyExtraction();
  const e = extraction as Partial<Extraction>;
  const detalleEfectivo = e.detalle_efectivo as
    | Partial<Extraction["detalle_efectivo"]>
    | undefined;
  const rendicionIn = (e.rendicion ?? {}) as Partial<Extraction["rendicion"]>;
  const mergeField = (
    incoming: ExtractedField | undefined,
    fallback: ExtractedField
  ): ExtractedField => incoming ?? fallback;

  return {
    ...base,
    ...e,
    fecha: mergeField(e.fecha, base.fecha),
    conductor: mergeField(e.conductor, base.conductor),
    auxiliar: mergeField(e.auxiliar, base.auxiliar),
    n_recorrido: mergeField(e.n_recorrido, base.n_recorrido),
    patente: mergeField(e.patente, base.patente),
    cant_fact: mergeField(e.cant_fact, base.cant_fact),
    valor_total: mergeField(e.valor_total, base.valor_total),
    total_cheques: mergeField(e.total_cheques, base.total_cheques),
    total_n_c_rechazo_total: mergeField(
      e.total_n_c_rechazo_total,
      base.total_n_c_rechazo_total
    ),
    total_n_c_rechazo_parcial: mergeField(
      e.total_n_c_rechazo_parcial,
      base.total_n_c_rechazo_parcial
    ),
    total_n_c_por_negocios: mergeField(
      e.total_n_c_por_negocios,
      base.total_n_c_por_negocios
    ),
    total_transferencias: mergeField(
      e.total_transferencias,
      base.total_transferencias
    ),
    numero_deposito_en_efectivo: mergeField(
      e.numero_deposito_en_efectivo,
      base.numero_deposito_en_efectivo
    ),
    monto_deposito_en_efectivo: mergeField(
      e.monto_deposito_en_efectivo,
      base.monto_deposito_en_efectivo
    ),
    observaciones: mergeField(e.observaciones, base.observaciones),
    rendicion: {
      efectivo_total: mergeField(
        rendicionIn.efectivo_total,
        base.rendicion.efectivo_total
      ),
      cheques_al_dia: mergeField(
        rendicionIn.cheques_al_dia,
        base.rendicion.cheques_al_dia
      ),
      cheques_a_fecha: mergeField(
        rendicionIn.cheques_a_fecha,
        base.rendicion.cheques_a_fecha
      ),
      credito_vendedor: mergeField(
        rendicionIn.credito_vendedor,
        base.rendicion.credito_vendedor
      ),
      retorno_total: mergeField(
        rendicionIn.retorno_total,
        base.rendicion.retorno_total
      ),
      retorno_parcial: mergeField(
        rendicionIn.retorno_parcial,
        base.rendicion.retorno_parcial
      ),
      n_c_negocio: mergeField(
        rendicionIn.n_c_negocio,
        base.rendicion.n_c_negocio
      ),
      transferencia: mergeField(
        rendicionIn.transferencia,
        base.rendicion.transferencia
      ),
      total: mergeField(rendicionIn.total, base.rendicion.total),
    },
    detalle_efectivo: normalizeDetalleEfectivo(detalleEfectivo),
    detalles_cheques: e.detalles_cheques ?? base.detalles_cheques,
    n_c_rechazo_total: e.n_c_rechazo_total ?? base.n_c_rechazo_total,
    n_c_rechazo_parcial: e.n_c_rechazo_parcial ?? base.n_c_rechazo_parcial,
    n_c_por_negocios: e.n_c_por_negocios ?? base.n_c_por_negocios,
    detalle_transferencias: (e.detalle_transferencias ?? base.detalle_transferencias).map(
      (row) => ({
        no_fac: row.no_fac ?? { ...EMPTY_FIELD },
        valor: row.valor ?? { ...EMPTY_FIELD },
        cliente: row.cliente ?? { ...EMPTY_FIELD },
        banco: row.banco ?? { ...EMPTY_FIELD },
      })
    ),
    detalle_credito_vendedor: (
      e.detalle_credito_vendedor ?? base.detalle_credito_vendedor
    ).map((row) => ({
      no_fac: row.no_fac ?? { ...EMPTY_FIELD },
      valor: row.valor ?? { ...EMPTY_FIELD },
      cliente: row.cliente ?? { ...EMPTY_FIELD },
      nro_vendedor: row.nro_vendedor ?? { ...EMPTY_FIELD },
    })),
    _meta: e._meta ?? base._meta,
  };
}

export function createEmptyExtraction(): Extraction {
  return {
    fecha: { ...EMPTY_FIELD },
    conductor: { ...EMPTY_FIELD },
    auxiliar: { ...EMPTY_FIELD },
    n_recorrido: { ...EMPTY_FIELD },
    patente: { ...EMPTY_FIELD },
    cant_fact: { ...EMPTY_FIELD },
    valor_total: { ...EMPTY_FIELD },
    rendicion: {
      efectivo_total: { ...EMPTY_FIELD },
      cheques_al_dia: { ...EMPTY_FIELD },
      cheques_a_fecha: { ...EMPTY_FIELD },
      credito_vendedor: { ...EMPTY_FIELD },
      retorno_total: { ...EMPTY_FIELD },
      retorno_parcial: { ...EMPTY_FIELD },
      n_c_negocio: { ...EMPTY_FIELD },
      transferencia: { ...EMPTY_FIELD },
      total: { ...EMPTY_FIELD },
    },
    detalles_cheques: [],
    total_cheques: { ...EMPTY_FIELD },
    n_c_rechazo_total: [],
    n_c_rechazo_parcial: [],
    n_c_por_negocios: [],
    detalle_transferencias: [],
    detalle_credito_vendedor: [],
    detalle_efectivo: {
      billetes: [],
      monedas: [],
      total_billetes: { ...EMPTY_FIELD },
      total_monedas: { ...EMPTY_FIELD },
      total_efectivo: { ...EMPTY_FIELD },
    },
    total_n_c_rechazo_total: { ...EMPTY_FIELD },
    total_n_c_rechazo_parcial: { ...EMPTY_FIELD },
    total_n_c_por_negocios: { ...EMPTY_FIELD },
    total_transferencias: { ...EMPTY_FIELD },
    numero_deposito_en_efectivo: { ...EMPTY_FIELD },
    monto_deposito_en_efectivo: { ...EMPTY_FIELD },
    observaciones: { ...EMPTY_FIELD },
  };
}
