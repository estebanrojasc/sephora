import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../../src/features/records/types.ts";
import { buildRendicionPayload } from "../../src/features/excel/build-rendicion.ts";

// Monkey-patch: import render module internals via copying approach
// Simulate OLD behavior: templateDataRows=1 for cheques_a_fecha
import * as renderMod from "../../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");
const e = createEmptyExtraction();
e.fecha = { valor: "30/06/2026", bbox: [0, 0, 0, 0] };

const alDia = Array.from({ length: 17 }, (_, i) => ({
  fecha: { valor: "30/06/2026", bbox: [0, 0, 0, 0] },
  banco: { valor: `B${i}`, bbox: [0, 0, 0, 0] },
  valor: { valor: String(1000 * (i + 1)), bbox: [0, 0, 0, 0] },
}));
const aFecha = [
  { fecha: { valor: "", bbox: [0, 0, 0, 0] }, banco: { valor: "", bbox: [0, 0, 0, 0] }, valor: { valor: "127092", bbox: [0, 0, 0, 0] } },
  { fecha: { valor: "", bbox: [0, 0, 0, 0] }, banco: { valor: "", bbox: [0, 0, 0, 0] }, valor: { valor: "972618", bbox: [0, 0, 0, 0] } },
  { fecha: { valor: "", bbox: [0, 0, 0, 0] }, banco: { valor: "", bbox: [0, 0, 0, 0] }, valor: { valor: "368449", bbox: [0, 0, 0, 0] } },
  { fecha: { valor: "", bbox: [0, 0, 0, 0] }, banco: { valor: "", bbox: [0, 0, 0, 0] }, valor: { valor: "92552", bbox: [0, 0, 0, 0] } },
];
e.detalles_cheques = [...alDia, ...aFecha];
e.n_c_rechazo_total = Array.from({ length: 17 }, () => ({ no_fac: { valor: "1", bbox: [0,0,0,0] }, valor: { valor: "100", bbox: [0,0,0,0] } }));

const payload = buildRendicionPayload({ id: "x", status: "saved", createdAt: "", updatedAt: "", images: [], extraction: e });
console.log("lists:", payload.lists.cheques_al_dia.length, payload.lists.cheques_a_fecha.length);

const out = renderMod.renderRendicionExcel(template, payload);
writeFileSync("scripts/.tmp/current-render.xlsx", out);

const sheet = new TextDecoder().decode(unzipSync(out)["xl/worksheets/sheet1.xml"]);
for (const r of [55, 56, 57, 58, 59, 60]) {
  const m = sheet.match(new RegExp(`<row\\b[^>]*\\br="${r}"[^>]*>[\\s\\S]*?<\\/row>`));
  console.log(`ROW ${r}:`, m ? m[0].slice(0, 200) : "NF");
}
