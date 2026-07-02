import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../../src/features/records/types.ts";
import { buildConsolidatedWorkbook } from "../../src/features/excel/build-consolidated.ts";
import { buildRendicionPayload } from "../../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function bitacora(excel) {
  return { bitacoraId: "x", rowId: "y", version: 1, matchScore: 0, suggested: {}, recognized: {}, applied: {}, excel };
}

const e = createEmptyExtraction();
e.fecha.valor = "30-06-2026";
e.conductor.valor = "PEDRO";
e.n_recorrido.valor = "260006320";
e.cant_fact.valor = "5";
e.valor_total.valor = "1054260";
e.rendicion.cheques_a_fecha.valor = "461001";
e.detalles_cheques = [
  { fecha: { valor: "30-07-2026", bbox: [0,0,0,0] }, banco: { valor: "BCI", bbox: [0,0,0,0] }, valor: { valor: "368449", bbox: [0,0,0,0] } },
];
e._meta = { bitacora: bitacora({ conductor: "PEDRO", recorrido: "260006320", n_factura: "5", total_factura: "1054260" }) };

const record = { id: "1", status: "saved", createdAt: "", updatedAt: "", images: [], extraction: e };

const cons = buildConsolidatedWorkbook(template, [record]);
writeFileSync("scripts/.tmp/cons-check.xlsx", cons);

const f = unzipSync(cons);
const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);
const cellCount = (sheet.match(/<c r="/g) || []).length;
const rowCount = (sheet.match(/<row\b/g) || []).length;
const b1 = sheet.match(/<c r="B1"[^>]*>([\s\S]*?)<\/c>|<c r="B1"[^/]*\/>/);
const m39 = sheet.match(/<c r="M39"[^>]*>([\s\S]*?)<\/c>|<c r="M39"[^/]*\/>/);
const n23 = sheet.match(/<c r="N23"[^>]*>([\s\S]*?)<\/c>/);

console.log({ bytes: cons.byteLength, cellCount, rowCount, files: Object.keys(f).length });
console.log("B1:", b1?.[0]?.slice(0, 120));
console.log("M39:", m39?.[0]?.slice(0, 120));
console.log("N23:", n23?.[0]?.slice(0, 120));

const ind = renderRendicionExcel(template, buildRendicionPayload(record));
const indSheet = new TextDecoder().decode(unzipSync(ind)["xl/worksheets/sheet1.xml"]);
console.log("individual cells:", (indSheet.match(/<c r="/g) || []).length);
