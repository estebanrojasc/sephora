import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../../src/features/records/types.ts";
import { buildRendicionPayload } from "../../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");
const e = createEmptyExtraction();
e.fecha = { valor: "30/06/2026", bbox: [0, 0, 0, 0] };

const alDia = Array.from({ length: 18 }, (_, i) => ({
  fecha: { valor: "", bbox: [0, 0, 0, 0] },
  banco: { valor: "", bbox: [0, 0, 0, 0] },
  valor: { valor: String(10000 * (i + 1)), bbox: [0, 0, 0, 0] },
}));

const aFecha = [
  { fecha: { valor: "", bbox: [0, 0, 0, 0] }, banco: { valor: "", bbox: [0, 0, 0, 0] }, valor: { valor: "127092", bbox: [0, 0, 0, 0] } },
  { fecha: { valor: "", bbox: [0, 0, 0, 0] }, banco: { valor: "", bbox: [0, 0, 0, 0] }, valor: { valor: "972618", bbox: [0, 0, 0, 0] } },
  { fecha: { valor: "", bbox: [0, 0, 0, 0] }, banco: { valor: "", bbox: [0, 0, 0, 0] }, valor: { valor: "368449", bbox: [0, 0, 0, 0] } },
  { fecha: { valor: "", bbox: [0, 0, 0, 0] }, banco: { valor: "", bbox: [0, 0, 0, 0] }, valor: { valor: "92552", bbox: [0, 0, 0, 0] } },
];

e.detalles_cheques = [...alDia, ...aFecha];

const payload = buildRendicionPayload({ id: "x", status: "saved", createdAt: "", updatedAt: "", images: [], extraction: e });
console.log("a_fecha sample:", payload.lists.cheques_a_fecha[0]);

const out = renderRendicionExcel(template, payload);
const sheet = new TextDecoder().decode(unzipSync(out)["xl/worksheets/sheet1.xml"]);

function rowXml(r) {
  const m = sheet.match(new RegExp(`<row\\b[^>]*\\br="${r}"[^>]*>[\\s\\S]*?<\\/row>`));
  return m ? m[0] : "NOT FOUND";
}

for (const r of [56, 57, 58, 59]) {
  console.log(`\nROW ${r}:`, rowXml(r));
}
