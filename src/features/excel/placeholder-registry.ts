import type { RendicionLists } from "./build-rendicion";

export interface ListPlaceholderDef {
  list: keyof RendicionLists;
  field: string;
  type: "text" | "number";
  firstRowOnly?: boolean;
}

/** Mapa placeholder de lista → campo en RendicionPayload.lists */
export const LIST_PLACEHOLDER_REGISTRY: Record<string, ListPlaceholderDef> = {
  "{{billete_denom}}": { list: "billetes", field: "denom", type: "text" },
  "{{billete_valor}}": { list: "billetes", field: "valor", type: "number" },
  "{{moneda_denom}}": { list: "monedas", field: "denom", type: "text" },
  "{{moneda_valor}}": { list: "monedas", field: "valor", type: "number" },
  "{{chq_fechas}}": { list: "cheques", field: "fecha", type: "text" },
  "{{chq_bancos}}": { list: "cheques", field: "banco", type: "text" },
  "{{chq_valores}}": { list: "cheques", field: "valor", type: "number" },
  "{{rech_tot_fac}}": { list: "rech_total", field: "fac", type: "number" },
  "{{rech_tot_val}}": { list: "rech_total", field: "val", type: "number" },
  "{{rech_par_fac}}": { list: "rech_parcial", field: "fac", type: "number" },
  "{{rech_par_val}}": { list: "rech_parcial", field: "val", type: "number" },
  "{{neg_fac}}": { list: "negocio", field: "fac", type: "number" },
  "{{neg_val}}": { list: "negocio", field: "val", type: "number" },
  "{{cred_cliente}}": { list: "credito_vendedor", field: "cliente", type: "text" },
  "{{cred_fac}}": { list: "credito_vendedor", field: "no_fac", type: "text" },
  "{{cred_valor}}": { list: "credito_vendedor", field: "valor", type: "number" },
  "{{cred_vend}}": { list: "credito_vendedor", field: "nro_vendedor", type: "text" },
  "{{transf_recorrido}}": {
    list: "transferencias",
    field: "recorrido",
    type: "text",
    firstRowOnly: true,
  },
  "{{transf_cliente}}": { list: "transferencias", field: "cliente", type: "text" },
  "{{transf_banco}}": { list: "transferencias", field: "banco", type: "text" },
  "{{transf_fac}}": { list: "transferencias", field: "no_fac", type: "text" },
  "{{transf_valor}}": { list: "transferencias", field: "valor", type: "number" },
};

/** Bloques que comparten inserción de filas (misma fila ancla en plantilla). */
export interface ListBlockGroup {
  id: string;
  placeholders: string[];
  count: (lists: RendicionLists) => number;
}

export const LIST_BLOCK_GROUPS: ListBlockGroup[] = [
  {
    id: "efectivo",
    placeholders: [
      "{{billete_denom}}",
      "{{billete_valor}}",
      "{{moneda_denom}}",
      "{{moneda_valor}}",
    ],
    count: (l) =>
      Math.max(l.billetes?.length ?? 0, l.monedas?.length ?? 0, 1),
  },
  {
    id: "fila_detalle",
    placeholders: [
      "{{chq_fechas}}",
      "{{chq_bancos}}",
      "{{chq_valores}}",
      "{{rech_tot_fac}}",
      "{{rech_tot_val}}",
      "{{rech_par_fac}}",
      "{{rech_par_val}}",
      "{{neg_fac}}",
      "{{neg_val}}",
    ],
    count: (l) =>
      Math.max(
        l.cheques?.length ?? 0,
        l.rech_total?.length ?? 0,
        l.rech_parcial?.length ?? 0,
        l.negocio?.length ?? 0,
        1
      ),
  },
  {
    id: "credito",
    placeholders: [
      "{{cred_cliente}}",
      "{{cred_fac}}",
      "{{cred_valor}}",
      "{{cred_vend}}",
    ],
    count: (l) => Math.max(l.credito_vendedor?.length ?? 0, 1),
  },
  {
    id: "transferencias",
    placeholders: [
      "{{transf_recorrido}}",
      "{{transf_cliente}}",
      "{{transf_banco}}",
      "{{transf_fac}}",
      "{{transf_valor}}",
    ],
    count: (l) => Math.max(l.transferencias?.length ?? 0, 1),
  },
];

/** Rutas alternativas en plantilla → ruta canónica extraction.*.valor */
export const SCALAR_PLACEHOLDER_ALIASES: Record<string, string> = {
  "{{extraction.rendicion.cant_fact.valor}}":
    "{{extraction.cant_fact.valor}}",
  "{{extraction.rendicion.valor_total.valor}}":
    "{{extraction.valor_total.valor}}",
  "{{extraction.rendicion.detalles_cheques.total_billetes.valor}}":
    "{{extraction.detalle_efectivo.total_billetes.valor}}",
  "{{extraction.rendicion.detalles_cheques.total_monedas.valor}}":
    "{{extraction.detalle_efectivo.total_monedas.valor}}",
};

/** Campos de texto (no numéricos) al recorrer extraction. */
export const TEXT_SCALAR_LEAF_KEYS = new Set([
  "fecha",
  "conductor",
  "auxiliar",
  "patente",
  "n_recorrido",
  "observaciones",
  "numero_deposito_en_efectivo",
]);

export const PLACEHOLDER_PATTERN = /^\{\{[a-zA-Z0-9_.]+\}\}$/;
