export type BitacoraRowType =
  | "ruta"
  | "entrega_pendiente"
  | "manual"
  | "totals"
  | "header"
  | "unknown";

export interface BitacoraRow {
  id: string;
  rowType: BitacoraRowType;
  manualSubtype?: string;

  territorio?: string;
  anden?: string;
  patente?: string;
  conductor?: string;
  auxiliar?: string;
  observacion?: string;
  sector?: string;
  recorrido?: string;
  recorridoSuffix?: string;
  primerFolio?: string;
  ultimoFolio?: string;
  cantFact?: string;
  puntos?: string;
  montoTotal?: string;

  /** Fecha propia de entrega pendiente (≠ date de la bitácora). */
  scheduledDate?: string;
  linkedRecordId?: string;
}

export interface Bitacora {
  id: string;
  /** YYYY-MM-DD — día de la bitácora (del encabezado). */
  date: string;
  title?: string;
  version: number;
  isActive: boolean;
  rows: BitacoraRow[];
  rawPaste: string;
  aiProvider?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBitacoraPayload {
  date: string;
  title?: string;
  rows: BitacoraRow[];
  rawPaste: string;
  aiProvider?: string;
}

export interface ParseBitacoraResult {
  date: string;
  title?: string;
  rows: BitacoraRow[];
  warnings: string[];
}

export interface BitacoraSuggestedFields {
  patente?: string;
  conductor?: string;
  auxiliar?: string;
  n_recorrido?: string;
  cant_fact?: string;
  valor_total?: string;
  sector?: string;
  observaciones?: string;
  /** Alias de cant_fact para Excel. */
  n_factura?: string;
  /** Alias de valor_total / montoTotal para Excel. */
  total_factura?: string;
  recorrido?: string;
}

export interface BitacoraMatch {
  bitacoraId: string;
  rowId: string;
  version: number;
  matchScore: number;
  suggested: BitacoraSuggestedFields;
  row: BitacoraRow;
}

export interface BitacoraMeta {
  bitacoraId: string;
  rowId: string;
  version: number;
  matchScore: number;
  suggested: BitacoraSuggestedFields;
}
