import type { Bbox, ExtractedField, Extraction } from "./types";

export interface BboxOverlay {
  bbox: Bbox;
  label: string;
  filled: boolean;
}

function isFilled(f: ExtractedField | undefined): boolean {
  return !!f && typeof f.valor === "string" && f.valor.trim().length > 0;
}

function hasBbox(f: ExtractedField | undefined): boolean {
  return !!f && f.bbox.some((v) => v !== 0);
}

function push(out: BboxOverlay[], label: string, f: ExtractedField | undefined) {
  if (!hasBbox(f)) return;
  out.push({ label, bbox: f!.bbox, filled: isFilled(f) });
}

/**
 * Recopila todos los bboxes de la extracción con su etiqueta legible para
 * pintarlos sobre la imagen en modo "calibración".
 */
export function collectOverlays(e: Extraction): BboxOverlay[] {
  const out: BboxOverlay[] = [];

  push(out, "fecha", e.fecha);
  push(out, "conductor", e.conductor);
  push(out, "auxiliar", e.auxiliar);
  push(out, "n_recorrido", e.n_recorrido);
  push(out, "patente", e.patente);
  push(out, "cant_fact", e.cant_fact);
  push(out, "valor_total", e.valor_total);

  push(out, "rend.efectivo", e.rendicion.efectivo_total);
  push(out, "rend.cheques_al_dia", e.rendicion.cheques_al_dia);
  push(out, "rend.cheques_a_fecha", e.rendicion.cheques_a_fecha);
  push(out, "rend.credito_vendedor", e.rendicion.credito_vendedor);
  push(out, "rend.retorno_total", e.rendicion.retorno_total);
  push(out, "rend.retorno_parcial", e.rendicion.retorno_parcial);
  push(out, "rend.nc_negocio", e.rendicion.n_c_negocio);
  push(out, "rend.transferencia", e.rendicion.transferencia);
  push(out, "rend.total", e.rendicion.total);

  e.detalles_cheques.forEach((row, i) => {
    push(out, `chq[${i}].fecha`, row.fecha);
    push(out, `chq[${i}].banco`, row.banco);
    push(out, `chq[${i}].valor`, row.valor);
  });
  push(out, "total_cheques", e.total_cheques);

  e.detalle_efectivo.billetes.forEach((row, i) => {
    push(out, `bill[${i}].denom`, row.denominacion);
    push(out, `bill[${i}].valor`, row.valor);
  });
  push(out, "total_efectivo", e.detalle_efectivo.total_efectivo);

  e.n_c_rechazo_total.forEach((row, i) => {
    push(out, `rechT[${i}].fac`, row.no_fac);
    push(out, `rechT[${i}].val`, row.valor);
  });
  push(out, "total_rech_total", e.total_n_c_rechazo_total);

  e.n_c_rechazo_parcial.forEach((row, i) => {
    push(out, `rechP[${i}].fac`, row.no_fac);
    push(out, `rechP[${i}].val`, row.valor);
  });
  push(out, "total_rech_parcial", e.total_n_c_rechazo_parcial);

  e.n_c_por_negocios.forEach((row, i) => {
    push(out, `negoc[${i}].fac`, row.no_fac);
    push(out, `negoc[${i}].val`, row.valor);
  });
  push(out, "total_negocios", e.total_n_c_por_negocios);

  (e.detalle_transferencias ?? []).forEach((row, i) => {
    push(out, `transf[${i}].fac`, row.no_fac);
    push(out, `transf[${i}].cliente`, row.cliente);
    push(out, `transf[${i}].val`, row.valor);
  });
  push(out, "total_transferencias", e.total_transferencias);

  (e.detalle_credito_vendedor ?? []).forEach((row, i) => {
    push(out, `cred_vend[${i}].fac`, row.no_fac);
    push(out, `cred_vend[${i}].cliente`, row.cliente);
    push(out, `cred_vend[${i}].vend`, row.nro_vendedor);
    push(out, `cred_vend[${i}].val`, row.valor);
  });

  push(out, "num_dep_efect", e.numero_deposito_en_efectivo);
  push(out, "monto_dep_efect", e.monto_deposito_en_efectivo);
  push(out, "observaciones", e.observaciones);

  return out;
}

export type BboxFormat = "px" | "norm-1000" | "norm-1";

export interface BboxCalibration {
  /** Formato detectado o forzado manualmente. */
  format: BboxFormat;
  /** Offset aditivo en unidades del formato (se aplica a x1 y x2). */
  offsetX: number;
  offsetY: number;
  /** Multiplicador (1 = sin cambio). */
  scaleX: number;
  scaleY: number;
}

export const DEFAULT_CALIBRATION: BboxCalibration = {
  format: "norm-1000",
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
};

/**
 * Detecta el formato del bbox: 0-1 normalizado, 0-1000 normalizado o píxeles.
 * Es tolerante a pequeños overshoots (Qwen a veces entrega 1005 en lugar de 1000).
 */
export function detectBboxFormat(bboxes: Bbox[]): BboxFormat {
  let max = 0;
  let countNonZero = 0;
  let countOver1200 = 0;
  for (const b of bboxes) {
    for (const v of b) {
      if (v > 0) {
        if (v > max) max = v;
        countNonZero += 1;
        if (v > 1200) countOver1200 += 1;
      }
    }
  }
  if (countNonZero === 0) return "norm-1000";
  if (max <= 1.5) return "norm-1";
  // Si <10% de los valores supera 1200, lo seguimos tratando como 0-1000 con
  // clamp; típico de modelos VL que devuelven 1005 por redondeo.
  if (countOver1200 / countNonZero < 0.1 && max <= 2000) return "norm-1000";
  return "px";
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

/**
 * Devuelve un objeto CSS posicionado relativamente al contenedor de la imagen.
 * Aplica calibración (offset + escala) antes de mapear a porcentaje.
 */
export function bboxToCss(
  bbox: Bbox,
  calibration: BboxCalibration,
  naturalWidth?: number,
  naturalHeight?: number
): React.CSSProperties | null {
  const { format, offsetX, offsetY, scaleX, scaleY } = calibration;
  let [x1, y1, x2, y2] = bbox;
  x1 = x1 * scaleX + offsetX;
  x2 = x2 * scaleX + offsetX;
  y1 = y1 * scaleY + offsetY;
  y2 = y2 * scaleY + offsetY;

  if (format === "norm-1") {
    const c1 = clamp(x1, 0, 1);
    const c2 = clamp(x2, 0, 1);
    const r1 = clamp(y1, 0, 1);
    const r2 = clamp(y2, 0, 1);
    return {
      left: `${c1 * 100}%`,
      top: `${r1 * 100}%`,
      width: `${Math.max(0, c2 - c1) * 100}%`,
      height: `${Math.max(0, r2 - r1) * 100}%`,
    };
  }
  if (format === "norm-1000") {
    const c1 = clamp(x1, 0, 1000);
    const c2 = clamp(x2, 0, 1000);
    const r1 = clamp(y1, 0, 1000);
    const r2 = clamp(y2, 0, 1000);
    return {
      left: `${c1 / 10}%`,
      top: `${r1 / 10}%`,
      width: `${Math.max(0, c2 - c1) / 10}%`,
      height: `${Math.max(0, r2 - r1) / 10}%`,
    };
  }
  if (naturalWidth && naturalHeight) {
    return {
      left: `${(x1 / naturalWidth) * 100}%`,
      top: `${(y1 / naturalHeight) * 100}%`,
      width: `${((x2 - x1) / naturalWidth) * 100}%`,
      height: `${((y2 - y1) / naturalHeight) * 100}%`,
    };
  }
  return null;
}
