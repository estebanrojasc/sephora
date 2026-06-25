export function buildBitacoraGeminiSchema() {
  return {
    type: "object",
    properties: {
      date: { type: "string" },
      title: { type: "string" },
      warnings: { type: "array", items: { type: "string" } },
      rows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rowType: {
              type: "string",
              enum: [
                "ruta",
                "entrega_pendiente",
                "manual",
                "totals",
                "header",
                "unknown",
              ],
            },
            manualSubtype: { type: "string" },
            territorio: { type: "string" },
            anden: { type: "string" },
            patente: { type: "string" },
            conductor: { type: "string" },
            auxiliar: { type: "string" },
            observacion: { type: "string" },
            sector: { type: "string" },
            recorrido: { type: "string" },
            recorridoSuffix: { type: "string" },
            primerFolio: { type: "string" },
            ultimoFolio: { type: "string" },
            cantFact: { type: "string" },
            puntos: { type: "string" },
            montoTotal: { type: "string" },
            scheduledDate: { type: "string" },
          },
          required: ["rowType"],
        },
      },
    },
    required: ["date", "rows", "warnings"],
  };
}
