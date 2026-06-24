import { readFileSync, writeFileSync } from "node:fs";
import { createEmptyExtraction } from "../src/features/records/types.ts";

// Minimal mock - import render via relative path after building
import { buildRendicionPayload } from "../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

const extraction = createEmptyExtraction();
extraction.conductor.valor = "JUAN PEREZ";
extraction.n_recorrido.valor = "12345";
extraction.cant_fact.valor = "10";
extraction.valor_total.valor = "1000000";
extraction.rendicion.efectivo_total.valor = "500000";
extraction.detalle_efectivo.total_billetes.valor = "450000";
extraction.detalle_efectivo.total_monedas.valor = "50000";
extraction.detalle_efectivo.billetes = [
  {
    denominacion: { valor: "20000", bbox: [0, 0, 0, 0] },
    valor: { valor: "400000", bbox: [0, 0, 0, 0] },
  },
  {
    denominacion: { valor: "10000", bbox: [0, 0, 0, 0] },
    valor: { valor: "50000", bbox: [0, 0, 0, 0] },
  },
];
extraction.detalle_efectivo.monedas = [
  {
    denominacion: { valor: "500", bbox: [0, 0, 0, 0] },
    valor: { valor: "50000", bbox: [0, 0, 0, 0] },
  },
];
extraction.detalles_cheques = [
  {
    fecha: { valor: "01/01/2026", bbox: [0, 0, 0, 0] },
    banco: { valor: "SANTANDER", bbox: [0, 0, 0, 0] },
    valor: { valor: "100000", bbox: [0, 0, 0, 0] },
  },
  {
    fecha: { valor: "02/01/2026", bbox: [0, 0, 0, 0] },
    banco: { valor: "BCI", bbox: [0, 0, 0, 0] },
    valor: { valor: "200000", bbox: [0, 0, 0, 0] },
  },
];
extraction.rendicion.cheques_al_dia.valor = "300000";
extraction.rendicion.total.valor = "1000000";

const record = {
  id: "test-id-001",
  status: "saved",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  images: [],
  extraction,
};

const payload = buildRendicionPayload(record);
console.log("Payload scalars keys:", Object.keys(payload.scalars).length);
console.log("Cheques:", payload.lists.cheques.length);
console.log("Billetes:", payload.lists.billetes.length);

try {
  const out = renderRendicionExcel(template, payload);
  writeFileSync("scripts/.tmp/rendicion-test-output.xlsx", out);
  console.log("OK wrote", out.byteLength, "bytes");
} catch (e) {
  console.error("FAIL", e);
  process.exit(1);
}
