import { readFileSync, writeFileSync } from "node:fs";
import { createEmptyExtraction } from "../src/features/records/types.ts";
import { buildConsolidatedWorkbook } from "../src/features/excel/build-consolidated.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function mockRecord(id, rec, conductor) {
  const extraction = createEmptyExtraction();
  extraction.conductor.valor = conductor;
  extraction.n_recorrido.valor = rec;
  extraction.cant_fact.valor = "5";
  extraction.valor_total.valor = "500000";
  extraction.rendicion.efectivo_total.valor = "100000";
  extraction.detalle_efectivo.total_billetes.valor = "90000";
  extraction.detalle_efectivo.total_monedas.valor = "10000";
  extraction.rendicion.total.valor = "500000";
  return {
    id,
    status: "saved",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    images: [],
    extraction,
  };
}

const records = [
  mockRecord("r1", "111", "ANA"),
  mockRecord("r2", "222", "BOB"),
];

const out = buildConsolidatedWorkbook(template, records);
writeFileSync("scripts/.tmp/consolidado-test.xlsx", out);
console.log("OK consolidated", out.byteLength, "bytes");
