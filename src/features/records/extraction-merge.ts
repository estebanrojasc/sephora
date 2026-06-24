import type {
  Extraction,
  ExtractedField,
  BilleteRow,
  ChequeRow,
  NCRow,
  TransferenciaRow,
  CreditoVendedorRow,
} from "./types";

function isFieldFilled(f: ExtractedField | undefined): boolean {
  return !!f && typeof f.valor === "string" && f.valor.trim().length > 0;
}

function mergeField(
  prev: ExtractedField | undefined,
  next: ExtractedField | undefined
): ExtractedField {
  if (isFieldFilled(next)) return next!;
  if (isFieldFilled(prev)) return prev!;
  return next ?? prev ?? { valor: "", bbox: [0, 0, 0, 0] };
}

function mergeChequeRows(
  prev: ChequeRow[] | undefined,
  next: ChequeRow[] | undefined
): ChequeRow[] {
  const a = prev ?? [];
  const b = next ?? [];
  const seen = new Set<string>();
  const result: ChequeRow[] = [];
  for (const row of [...a, ...b]) {
    const key = `${row.fecha.valor}|${row.banco.valor}|${row.valor.valor}`;
    if (key === "||" || seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

function mergeNCRows(
  prev: NCRow[] | undefined,
  next: NCRow[] | undefined
): NCRow[] {
  const a = prev ?? [];
  const b = next ?? [];
  const seen = new Set<string>();
  const result: NCRow[] = [];
  for (const row of [...a, ...b]) {
    const key = `${row.no_fac.valor}|${row.valor.valor}`;
    if (key === "|" || seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

function mergeTransferenciaRows(
  prev: TransferenciaRow[] | undefined,
  next: TransferenciaRow[] | undefined
): TransferenciaRow[] {
  const a = prev ?? [];
  const b = next ?? [];
  const byKey = new Map<string, TransferenciaRow>();
  for (const row of [...a, ...b]) {
    const key = `${row.no_fac.valor}|${row.valor.valor}`;
    if (key === "|") continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    byKey.set(key, {
      no_fac: mergeField(existing.no_fac, row.no_fac),
      valor: mergeField(existing.valor, row.valor),
      cliente: mergeField(existing.cliente, row.cliente),
    });
  }
  return [...byKey.values()];
}

function mergeCreditoVendedorRows(
  prev: CreditoVendedorRow[] | undefined,
  next: CreditoVendedorRow[] | undefined
): CreditoVendedorRow[] {
  const a = prev ?? [];
  const b = next ?? [];
  const byKey = new Map<string, CreditoVendedorRow>();
  for (const row of [...a, ...b]) {
    const key = `${row.no_fac.valor}|${row.valor.valor}|${row.nro_vendedor.valor}`;
    if (key === "||") continue;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, row);
      continue;
    }
    byKey.set(key, {
      no_fac: mergeField(existing.no_fac, row.no_fac),
      valor: mergeField(existing.valor, row.valor),
      cliente: mergeField(existing.cliente, row.cliente),
      nro_vendedor: mergeField(existing.nro_vendedor, row.nro_vendedor),
    });
  }
  return [...byKey.values()];
}

function mergeBilletes(
  prev: BilleteRow[] | undefined,
  next: BilleteRow[] | undefined
): BilleteRow[] {
  const a = prev ?? [];
  const b = next ?? [];
  const seen = new Set<string>();
  const result: BilleteRow[] = [];
  for (const row of [...a, ...b]) {
    const key = `${row.denominacion.valor}|${row.valor.valor}`;
    if (key === "|" || seen.has(key)) continue;
    seen.add(key);
    result.push(row);
  }
  return result;
}

/**
 * Combina dos extracciones. La nueva (b) rellena los huecos de la previa (a).
 * Si un campo ya tenía valor en (a) se conserva, salvo que (a) esté vacío.
 * Los arrays se concatenan deduplicando por contenido.
 */
export function mergeExtractions(a: Extraction, b: Extraction): Extraction {
  return {
    fecha: mergeField(a.fecha, b.fecha),
    conductor: mergeField(a.conductor, b.conductor),
    auxiliar: mergeField(a.auxiliar, b.auxiliar),
    n_recorrido: mergeField(a.n_recorrido, b.n_recorrido),
    patente: mergeField(a.patente, b.patente),
    cant_fact: mergeField(a.cant_fact, b.cant_fact),
    valor_total: mergeField(a.valor_total, b.valor_total),
    rendicion: {
      efectivo_total: mergeField(a.rendicion.efectivo_total, b.rendicion.efectivo_total),
      cheques_al_dia: mergeField(a.rendicion.cheques_al_dia, b.rendicion.cheques_al_dia),
      cheques_a_fecha: mergeField(a.rendicion.cheques_a_fecha, b.rendicion.cheques_a_fecha),
      credito_vendedor: mergeField(a.rendicion.credito_vendedor, b.rendicion.credito_vendedor),
      retorno_total: mergeField(a.rendicion.retorno_total, b.rendicion.retorno_total),
      retorno_parcial: mergeField(a.rendicion.retorno_parcial, b.rendicion.retorno_parcial),
      n_c_negocio: mergeField(a.rendicion.n_c_negocio, b.rendicion.n_c_negocio),
      transferencia: mergeField(a.rendicion.transferencia, b.rendicion.transferencia),
      total: mergeField(a.rendicion.total, b.rendicion.total),
    },
    detalles_cheques: mergeChequeRows(a.detalles_cheques, b.detalles_cheques),
    total_cheques: mergeField(a.total_cheques, b.total_cheques),
    n_c_rechazo_total: mergeNCRows(a.n_c_rechazo_total, b.n_c_rechazo_total),
    n_c_rechazo_parcial: mergeNCRows(a.n_c_rechazo_parcial, b.n_c_rechazo_parcial),
    n_c_por_negocios: mergeNCRows(a.n_c_por_negocios, b.n_c_por_negocios),
    detalle_transferencias: mergeTransferenciaRows(
      a.detalle_transferencias ?? [],
      b.detalle_transferencias ?? []
    ),
    detalle_credito_vendedor: mergeCreditoVendedorRows(
      a.detalle_credito_vendedor ?? [],
      b.detalle_credito_vendedor ?? []
    ),
    detalle_efectivo: {
      billetes: mergeBilletes(
        a.detalle_efectivo.billetes,
        b.detalle_efectivo.billetes
      ),
      total_efectivo: mergeField(
        a.detalle_efectivo.total_efectivo,
        b.detalle_efectivo.total_efectivo
      ),
    },
    total_n_c_rechazo_total: mergeField(a.total_n_c_rechazo_total, b.total_n_c_rechazo_total),
    total_n_c_rechazo_parcial: mergeField(a.total_n_c_rechazo_parcial, b.total_n_c_rechazo_parcial),
    total_n_c_por_negocios: mergeField(a.total_n_c_por_negocios, b.total_n_c_por_negocios),
    total_transferencias: mergeField(
      a.total_transferencias ?? { valor: "", bbox: [0, 0, 0, 0] },
      b.total_transferencias
    ),
    numero_deposito_en_efectivo: mergeField(a.numero_deposito_en_efectivo, b.numero_deposito_en_efectivo),
    monto_deposito_en_efectivo: mergeField(a.monto_deposito_en_efectivo, b.monto_deposito_en_efectivo),
    observaciones: mergeField(a.observaciones, b.observaciones),
    _meta: a._meta,
  };
}
