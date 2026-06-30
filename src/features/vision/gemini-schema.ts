/**
 * Construye el `response_schema` para Gemini (OpenAPI 3 dialect).
 * Forzar el schema con Structured Outputs hace que Gemini SIEMPRE devuelva
 * la estructura exacta y, si pedimos bboxes, integers 0-1000.
 */

type SchemaObject = {
  type: "OBJECT";
  properties: Record<string, JsonSchema>;
  required?: string[];
};

type SchemaArray = {
  type: "ARRAY";
  items: JsonSchema;
  minItems?: number;
  maxItems?: number;
};

type SchemaPrimitive = {
  type: "STRING" | "INTEGER" | "NUMBER" | "BOOLEAN";
  minimum?: number;
  maximum?: number;
};

export type JsonSchema = SchemaObject | SchemaArray | SchemaPrimitive;

function fieldSchema(withBboxes: boolean): SchemaObject {
  if (!withBboxes) {
    return {
      type: "OBJECT",
      properties: { valor: { type: "STRING" } },
      required: ["valor"],
    };
  }
  return {
    type: "OBJECT",
    properties: {
      valor: { type: "STRING" },
      bbox: {
        type: "ARRAY",
        items: { type: "INTEGER", minimum: 0, maximum: 1000 },
        minItems: 4,
        maxItems: 4,
      },
    },
    required: ["valor"],
  };
}

function chequeRowSchema(withBboxes: boolean): SchemaObject {
  return {
    type: "OBJECT",
    properties: {
      fecha: fieldSchema(withBboxes),
      banco: fieldSchema(withBboxes),
      valor: fieldSchema(withBboxes),
    },
    required: ["fecha", "banco", "valor"],
  };
}

function creditoVendedorRowSchema(withBboxes: boolean): SchemaObject {
  return {
    type: "OBJECT",
    properties: {
      no_fac: fieldSchema(withBboxes),
      cliente: fieldSchema(withBboxes),
      nro_vendedor: fieldSchema(withBboxes),
      valor: fieldSchema(withBboxes),
    },
    required: ["no_fac", "cliente", "nro_vendedor", "valor"],
  };
}

function transferenciaRowSchema(withBboxes: boolean): SchemaObject {
  return {
    type: "OBJECT",
    properties: {
      no_fac: fieldSchema(withBboxes),
      cliente: fieldSchema(withBboxes),
      banco: fieldSchema(withBboxes),
      valor: fieldSchema(withBboxes),
    },
    required: ["no_fac", "cliente", "banco", "valor"],
  };
}

function ncRowSchema(withBboxes: boolean): SchemaObject {
  return {
    type: "OBJECT",
    properties: {
      no_fac: fieldSchema(withBboxes),
      valor: fieldSchema(withBboxes),
    },
    required: ["no_fac", "valor"],
  };
}

function billeteRowSchema(withBboxes: boolean): SchemaObject {
  return {
    type: "OBJECT",
    properties: {
      denominacion: fieldSchema(withBboxes),
      valor: fieldSchema(withBboxes),
    },
    required: ["denominacion", "valor"],
  };
}

export function buildGeminiExtractionSchema(
  withBboxes: boolean
): SchemaObject {
  const f = () => fieldSchema(withBboxes);
  return {
    type: "OBJECT",
    properties: {
      fecha: f(),
      conductor: f(),
      auxiliar: f(),
      n_recorrido: f(),
      patente: f(),
      cant_fact: f(),
      valor_total: f(),
      rendicion: {
        type: "OBJECT",
        properties: {
          efectivo_total: f(),
          cheques_al_dia: f(),
          cheques_a_fecha: f(),
          credito_vendedor: f(),
          retorno_total: f(),
          retorno_parcial: f(),
          n_c_negocio: f(),
          transferencia: f(),
          total: f(),
        },
        required: [
          "efectivo_total",
          "cheques_al_dia",
          "cheques_a_fecha",
          "credito_vendedor",
          "retorno_total",
          "retorno_parcial",
          "n_c_negocio",
          "transferencia",
          "total",
        ],
      },
      detalles_cheques: {
        type: "ARRAY",
        items: chequeRowSchema(withBboxes),
      },
      total_cheques: f(),
      n_c_rechazo_total: { type: "ARRAY", items: ncRowSchema(withBboxes) },
      n_c_rechazo_parcial: { type: "ARRAY", items: ncRowSchema(withBboxes) },
      n_c_por_negocios: { type: "ARRAY", items: ncRowSchema(withBboxes) },
      detalle_transferencias: {
        type: "ARRAY",
        items: transferenciaRowSchema(withBboxes),
      },
      detalle_credito_vendedor: {
        type: "ARRAY",
        items: creditoVendedorRowSchema(withBboxes),
      },
      detalle_efectivo: {
        type: "OBJECT",
        properties: {
          billetes: { type: "ARRAY", items: billeteRowSchema(withBboxes) },
          monedas: { type: "ARRAY", items: billeteRowSchema(withBboxes) },
          total_billetes: f(),
          total_monedas: f(),
          total_efectivo: f(),
        },
        required: [
          "billetes",
          "monedas",
          "total_billetes",
          "total_monedas",
          "total_efectivo",
        ],
      },
      total_n_c_rechazo_total: f(),
      total_n_c_rechazo_parcial: f(),
      total_n_c_por_negocios: f(),
      total_transferencias: f(),
      numero_deposito_en_efectivo: f(),
      monto_deposito_en_efectivo: f(),
      observaciones: f(),
    },
    required: [
      "fecha",
      "conductor",
      "auxiliar",
      "n_recorrido",
      "patente",
      "cant_fact",
      "valor_total",
      "rendicion",
      "detalles_cheques",
      "total_cheques",
      "n_c_rechazo_total",
      "n_c_rechazo_parcial",
      "n_c_por_negocios",
      "detalle_transferencias",
      "detalle_credito_vendedor",
      "detalle_efectivo",
      "total_n_c_rechazo_total",
      "total_n_c_rechazo_parcial",
      "total_n_c_por_negocios",
      "total_transferencias",
      "numero_deposito_en_efectivo",
      "monto_deposito_en_efectivo",
      "observaciones",
    ],
  };
}
