/** Placeholders que se reemplazan por fórmulas =SUMA() tras expandir listas. */
export const FORMULA_SCALAR_PLACEHOLDERS = new Set([
  "{{extraction.rendicion.cheques_al_dia.valor}}",
  "{{extraction.total_n_c_rechazo_total.valor}}",
  "{{extraction.total_n_c_rechazo_parcial.valor}}",
  "{{extraction.total_n_c_por_negocios.valor}}",
]);

export interface SumFormulaRule {
  placeholder: string;
  sumColumn: string;
  blockId: string;
}

export const SUM_FORMULA_RULES: SumFormulaRule[] = [
  {
    placeholder: "{{extraction.rendicion.cheques_al_dia.valor}}",
    sumColumn: "O",
    blockId: "cheques_rech",
  },
  {
    placeholder: "{{extraction.total_n_c_rechazo_total.valor}}",
    sumColumn: "Q",
    blockId: "cheques_rech",
  },
  {
    placeholder: "{{extraction.total_n_c_rechazo_parcial.valor}}",
    sumColumn: "S",
    blockId: "cheques_rech",
  },
  {
    placeholder: "{{extraction.total_n_c_por_negocios.valor}}",
    sumColumn: "U",
    blockId: "cheques_rech",
  },
];
