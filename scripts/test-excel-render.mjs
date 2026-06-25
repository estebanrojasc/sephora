import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../src/features/records/types.ts";
import { buildRendicionPayload } from "../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../src/features/excel/render.ts";
import { buildConsolidatedWorkbook } from "../src/features/excel/build-consolidated.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function mockRecord(id, rec, conductor, extra = {}) {
  const extraction = createEmptyExtraction();
  extraction.conductor.valor = conductor;
  extraction.n_recorrido.valor = rec;
  extraction.fecha.valor = "24/06/2026";
  extraction.cant_fact.valor = "10";
  extraction.valor_total.valor = "1000000";
  extraction.rendicion.efectivo_total.valor = "500000";
  extraction.detalle_efectivo.total_billetes.valor = "450000";
  extraction.detalle_efectivo.total_monedas.valor = "50000";
  extraction.rendicion.cheques_al_dia.valor = "300000";
  extraction.rendicion.total.valor = "1000000";
  extraction.detalles_cheques = [
    {
      fecha: { valor: "01/01/2026", bbox: [0, 0, 0, 0] },
      banco: { valor: "SANTANDER", bbox: [0, 0, 0, 0] },
      valor: { valor: "100000", bbox: [0, 0, 0, 0] },
    },
  ];
  extraction.detalle_transferencias = [
    {
      no_fac: { valor: "F001", bbox: [0, 0, 0, 0] },
      valor: { valor: "150000", bbox: [0, 0, 0, 0] },
      cliente: { valor: "CLIENTE UNO", bbox: [0, 0, 0, 0] },
      banco: { valor: "SANTANDER", bbox: [0, 0, 0, 0] },
    },
  ];
  Object.assign(extraction, extra);
  return {
    id,
    status: "saved",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    images: [],
    extraction,
  };
}

const record = mockRecord("test-1", "12345", "JUAN PEREZ");
const payload = buildRendicionPayload(record);
const individual = renderRendicionExcel(template, payload);
writeFileSync("scripts/.tmp/rendicion-test-output.xlsx", individual);

const consolidated = buildConsolidatedWorkbook(template, [
  record,
  mockRecord("test-2", "67890", "MARIA LOPEZ"),
]);
writeFileSync("scripts/.tmp/consolidado-test.xlsx", consolidated);

function validate(path) {
  const f = unzipSync(readFileSync(path));
  const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);
  const strings = [];
  for (const m of new TextDecoder()
    .decode(f["xl/sharedStrings.xml"])
    .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    strings.push(m[1].replace(/<[^>]+>/g, ""));
  }
  let stale = 0;
  for (const m of sheet.matchAll(/<c\b[^>]*>\s*<v>(\d+)<\/v>\s*<\/c>/g)) {
    const s = strings[parseInt(m[1], 10)];
    if (s?.includes("{{")) stale++;
  }
  const dim = sheet.match(/<dimension ref="([^"]+)"/)?.[1];
  const sheets = new TextDecoder()
    .decode(f["xl/workbook.xml"])
    .match(/<sheet name="[^"]+"/g)?.length;
  console.log(`${path}: dim=${dim} staleCells=${stale} sheets=${sheets ?? 1}`);
}

console.log("Individual OK:", individual.byteLength, "bytes");
console.log("Consolidado OK:", consolidated.byteLength, "bytes");
validate("scripts/.tmp/rendicion-test-output.xlsx");
validate("scripts/.tmp/consolidado-test.xlsx");
