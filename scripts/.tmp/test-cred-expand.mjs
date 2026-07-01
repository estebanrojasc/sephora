import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../../src/features/records/types.ts";
import { buildRendicionPayload } from "../../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../../src/features/excel/render.ts";
import { buildConsolidatedWorkbook } from "../../src/features/excel/build-consolidated.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function mockRecord() {
  const extraction = createEmptyExtraction();
  extraction.conductor.valor = "JUAN";
  extraction.n_recorrido.valor = "12345";
  extraction.rendicion.cheques_al_dia.valor = "111";
  extraction.rendicion.cheques_a_fecha.valor = "222";
  extraction.rendicion.credito_vendedor.valor = "333";
  extraction.rendicion.retorno_total.valor = "444";
  extraction.rendicion.retorno_parcial.valor = "555";
  extraction.rendicion.n_c_negocio.valor = "666";
  extraction.rendicion.transferencia.valor = "777";
  extraction.detalle_efectivo.total_billetes.valor = "888";
  extraction.detalle_efectivo.total_monedas.valor = "999";
  extraction.detalle_credito_vendedor = [
    { cliente: { valor: "C1", bbox: [0, 0, 0, 0] }, no_fac: { valor: "F1", bbox: [0, 0, 0, 0] }, valor: { valor: "100", bbox: [0, 0, 0, 0] }, nro_vendedor: { valor: "V1", bbox: [0, 0, 0, 0] } },
    { cliente: { valor: "C2", bbox: [0, 0, 0, 0] }, no_fac: { valor: "F2", bbox: [0, 0, 0, 0] }, valor: { valor: "200", bbox: [0, 0, 0, 0] }, nro_vendedor: { valor: "V2", bbox: [0, 0, 0, 0] } },
    { cliente: { valor: "C3", bbox: [0, 0, 0, 0] }, no_fac: { valor: "F3", bbox: [0, 0, 0, 0] }, valor: { valor: "300", bbox: [0, 0, 0, 0] }, nro_vendedor: { valor: "V3", bbox: [0, 0, 0, 0] } },
  ];
  extraction.detalle_transferencias = [
    { cliente: { valor: "T1", bbox: [0, 0, 0, 0] }, no_fac: { valor: "TF1", bbox: [0, 0, 0, 0] }, valor: { valor: "50", bbox: [0, 0, 0, 0] }, banco: { valor: "BCI", bbox: [0, 0, 0, 0] } },
    { cliente: { valor: "T2", bbox: [0, 0, 0, 0] }, no_fac: { valor: "TF2", bbox: [0, 0, 0, 0] }, valor: { valor: "60", bbox: [0, 0, 0, 0] }, banco: { valor: "SANT", bbox: [0, 0, 0, 0] } },
    { cliente: { valor: "T3", bbox: [0, 0, 0, 0] }, no_fac: { valor: "TF3", bbox: [0, 0, 0, 0] }, valor: { valor: "70", bbox: [0, 0, 0, 0] }, banco: { valor: "EST", bbox: [0, 0, 0, 0] } },
  ];
  return {
    id: "test",
    status: "saved",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    images: [],
    extraction,
  };
}

const record = mockRecord();
const payload = buildRendicionPayload(record);
console.log("credito rows", payload.lists.credito_vendedor.length);
console.log("transfer rows", payload.lists.transferencias.length);

const individual = renderRendicionExcel(template, payload);
writeFileSync("scripts/.tmp/cred-test.xlsx", individual);

const consolidated = buildConsolidatedWorkbook(template, [record, { ...record, id: "test2" }]);
writeFileSync("scripts/.tmp/cred-consolidated.xlsx", consolidated);

function cellValues(path, col, fromRow, toRow) {
  const f = unzipSync(readFileSync(path));
  const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);
  const out = [];
  for (let r = fromRow; r <= toRow; r++) {
    const m = sheet.match(new RegExp(`<c r="${col}${r}"[^>]*>([\\s\\S]*?)</c>`));
    if (!m) {
      out.push(`${col}${r}: (missing)`);
      continue;
    }
    const inline = m[1].match(/<t[^>]*>([^<]*)</)?.[1];
    const v = m[1].match(/<v>([^<]*)</)?.[1];
    out.push(`${col}${r}: ${inline ?? v ?? "empty"}`);
  }
  return out;
}

console.log("\nIndividual credit col M 71-76:");
console.log(cellValues("scripts/.tmp/cred-test.xlsx", "M", 71, 76).join("\n"));
console.log("\nIndividual transfer col M 73-78:");
console.log(cellValues("scripts/.tmp/cred-test.xlsx", "M", 73, 78).join("\n"));

console.log("\nConsolidated row 11 col B (cheques_al_dia):");
console.log(cellValues("scripts/.tmp/cred-consolidated.xlsx", "B", 11, 11).join("\n"));
console.log("\nConsolidated row 22 col M (lower section scalar area):");
console.log(cellValues("scripts/.tmp/cred-consolidated.xlsx", "M", 22, 22).join("\n"));

// stale placeholders in lower area
const f = unzipSync(readFileSync("scripts/.tmp/cred-consolidated.xlsx"));
const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);
const strings = [];
for (const m of new TextDecoder().decode(f["xl/sharedStrings.xml"]).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
  strings.push(m[1].replace(/<[^>]+>/g, ""));
}
let staleLower = 0;
for (const m of sheet.matchAll(/<c r="[A-Z]+(\d+)"[^>]*>\s*<v>(\d+)<\/v>\s*<\/c>/g)) {
  const row = parseInt(m[1], 10);
  if (row < 22) continue;
  const s = strings[parseInt(m[2], 10)];
  if (s?.includes("rendicion.")) staleLower++;
}
console.log("\nStale rendicion placeholders row>=22:", staleLower);
