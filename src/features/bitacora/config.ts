/** Cantidad de dígitos finales del recorrido usados para matching (4 hoy, 5 en el futuro). */
export const RECORRIDO_SUFFIX_LEN = Number.parseInt(
  process.env.RECORRIDO_SUFFIX_LEN ?? "4",
  10
);

/** Score mínimo para considerar match confiable en OCR hints. */
export const BITACORA_MATCH_THRESHOLD = 40;
