import type {
  ChequeRow,
  Extraction,
  ExtractedField,
  NCRow,
  BilleteRow,
} from "./types";

/**
 * Calcula la lista de claves de una extracción que cambiaron de valor entre
 * dos versiones. Devuelve rutas tipo "conductor", "rendicion.total" o
 * "detalles_cheques[2].banco". Sirve para auditar correcciones manuales tras
 * la IA: se persiste en `ExtractionAttempt.modifiedFields`.
 *
 * Solo compara el campo `valor` de cada `ExtractedField` (lo que en realidad
 * edita el admin). Los `bbox` se ignoran porque pueden cambiar sin que el
 * usuario haya "corregido" un dato.
 */
export function diffExtractions(
  before: Extraction | undefined,
  after: Extraction
): string[] {
  if (!before) {
    // Sin extracción previa: todo lo que tenga valor cuenta como modificado.
    const modified: string[] = [];
    walkExtraction(after, (path, valor) => {
      if (valor.trim()) modified.push(path);
    });
    return modified;
  }

  const modified: string[] = [];

  for (const key of TOP_LEVEL_FIELDS) {
    if (fieldChanged(before[key], after[key])) modified.push(key);
  }

  for (const key of RENDICION_FIELDS) {
    if (fieldChanged(before.rendicion[key], after.rendicion[key])) {
      modified.push(`rendicion.${key}`);
    }
  }

  // Arrays: comparamos por índice; si cambia longitud lo registramos a nivel
  // de array y como filas afectadas.
  diffRowArray(
    "detalles_cheques",
    before.detalles_cheques,
    after.detalles_cheques,
    ["fecha", "banco", "valor"] as const,
    modified
  );
  diffRowArray(
    "n_c_rechazo_total",
    before.n_c_rechazo_total,
    after.n_c_rechazo_total,
    ["no_fac", "valor"] as const,
    modified
  );
  diffRowArray(
    "n_c_rechazo_parcial",
    before.n_c_rechazo_parcial,
    after.n_c_rechazo_parcial,
    ["no_fac", "valor"] as const,
    modified
  );
  diffRowArray(
    "n_c_por_negocios",
    before.n_c_por_negocios,
    after.n_c_por_negocios,
    ["no_fac", "valor"] as const,
    modified
  );
  diffRowArray(
    "detalle_transferencias",
    before.detalle_transferencias,
    after.detalle_transferencias,
    ["no_fac", "cliente", "valor"] as const,
    modified
  );
  diffRowArray<BilleteRow, "denominacion" | "valor">(
    "detalle_efectivo.billetes",
    before.detalle_efectivo.billetes,
    after.detalle_efectivo.billetes,
    ["denominacion", "valor"] as const,
    modified
  );

  if (
    fieldChanged(
      before.detalle_efectivo.total_efectivo,
      after.detalle_efectivo.total_efectivo
    )
  ) {
    modified.push("detalle_efectivo.total_efectivo");
  }

  return modified;
}

function fieldChanged(
  before: ExtractedField | undefined,
  after: ExtractedField | undefined
): boolean {
  const a = (before?.valor ?? "").trim();
  const b = (after?.valor ?? "").trim();
  return a !== b;
}

function diffRowArray<T extends ChequeRow | NCRow | BilleteRow, K extends string>(
  basePath: string,
  before: T[] | undefined,
  after: T[],
  columns: readonly K[],
  modified: string[]
): void {
  const prev = before ?? [];
  if (prev.length !== after.length) modified.push(basePath);
  const max = Math.max(prev.length, after.length);
  for (let i = 0; i < max; i++) {
    const prevRow = prev[i];
    const nextRow = after[i];
    for (const col of columns) {
      const pField = prevRow
        ? (prevRow as unknown as Record<string, ExtractedField>)[col]
        : undefined;
      const nField = nextRow
        ? (nextRow as unknown as Record<string, ExtractedField>)[col]
        : undefined;
      if (fieldChanged(pField, nField)) {
        modified.push(`${basePath}[${i}].${col}`);
      }
    }
  }
}

const TOP_LEVEL_FIELDS = [
  "fecha",
  "conductor",
  "auxiliar",
  "n_recorrido",
  "patente",
  "cant_fact",
  "valor_total",
  "total_cheques",
  "total_n_c_rechazo_total",
  "total_n_c_rechazo_parcial",
  "total_n_c_por_negocios",
  "total_transferencias",
  "numero_deposito_en_efectivo",
  "monto_deposito_en_efectivo",
  "observaciones",
] as const satisfies readonly (keyof Extraction)[];

const RENDICION_FIELDS = [
  "efectivo_total",
  "cheques_al_dia",
  "cheques_a_fecha",
  "credito_vendedor",
  "retorno_total",
  "retorno_parcial",
  "n_c_negocio",
  "transferencia",
  "total",
] as const satisfies readonly (keyof Extraction["rendicion"])[];

/** Recorre una extracción enumerando rutas de campos individuales. */
function walkExtraction(
  ex: Extraction,
  visit: (path: string, valor: string) => void
): void {
  for (const key of TOP_LEVEL_FIELDS) visit(key, ex[key].valor);
  for (const key of RENDICION_FIELDS) {
    visit(`rendicion.${key}`, ex.rendicion[key].valor);
  }
  ex.detalles_cheques.forEach((row, i) => {
    visit(`detalles_cheques[${i}].fecha`, row.fecha.valor);
    visit(`detalles_cheques[${i}].banco`, row.banco.valor);
    visit(`detalles_cheques[${i}].valor`, row.valor.valor);
  });
  ex.n_c_rechazo_total.forEach((row, i) => {
    visit(`n_c_rechazo_total[${i}].no_fac`, row.no_fac.valor);
    visit(`n_c_rechazo_total[${i}].valor`, row.valor.valor);
  });
  ex.n_c_rechazo_parcial.forEach((row, i) => {
    visit(`n_c_rechazo_parcial[${i}].no_fac`, row.no_fac.valor);
    visit(`n_c_rechazo_parcial[${i}].valor`, row.valor.valor);
  });
  ex.n_c_por_negocios.forEach((row, i) => {
    visit(`n_c_por_negocios[${i}].no_fac`, row.no_fac.valor);
    visit(`n_c_por_negocios[${i}].valor`, row.valor.valor);
  });
  (ex.detalle_transferencias ?? []).forEach((row, i) => {
    visit(`detalle_transferencias[${i}].no_fac`, row.no_fac.valor);
    visit(`detalle_transferencias[${i}].cliente`, row.cliente.valor);
    visit(`detalle_transferencias[${i}].valor`, row.valor.valor);
  });
  ex.detalle_efectivo.billetes.forEach((row, i) => {
    visit(`detalle_efectivo.billetes[${i}].denominacion`, row.denominacion.valor);
    visit(`detalle_efectivo.billetes[${i}].valor`, row.valor.valor);
  });
  visit("detalle_efectivo.total_efectivo", ex.detalle_efectivo.total_efectivo.valor);
}
