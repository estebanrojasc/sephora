import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../../src/features/records/types.ts";
import { buildRendicionPayload } from "../../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../../src/features/excel/render.ts";

mkdirSync("scripts/.tmp", { recursive: true });
const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");
const e = createEmptyExtraction();
e.fecha.valor = "30/06/2026";
e.conductor.valor = "Test";
e.n_recorrido.valor = "123";
e.rendicion.cheques_al_dia.valor = "100";
const out = renderRendicionExcel(
  template,
  buildRendicionPayload({
    id: "x",
    status: "saved",
    createdAt: "",
    updatedAt: "",
    images: [],
    extraction: e,
  })
);
writeFileSync("scripts/.tmp/debug-out.xlsx", out);

const tpl = unzipSync(template);
const rendered = unzipSync(out);
const tplSheet = new TextDecoder().decode(tpl["xl/worksheets/sheet1.xml"]);
const sheet = new TextDecoder().decode(rendered["xl/worksheets/sheet1.xml"]);

console.log("template sheet bytes", tplSheet.length);
console.log("rendered sheet bytes", sheet.length);
console.log("rendered rows", (sheet.match(/<row\b/g) || []).length);
console.log("rendered cells", (sheet.match(/<c r=/g) || []).length);

const noR = [];
for (const m of sheet.matchAll(/<c\b([^>]*)(?:\/>|>)/g)) {
  if (!/\br="/.test(m[1])) noR.push(m[0].slice(0, 60));
}
console.log("cells missing r=", noR.length, noR.slice(0, 3));

const dupR = [];
for (const m of sheet.matchAll(/<c\b[^>]*>/g)) {
  if ((m[0].match(/\br="/g) || []).length > 1) dupR.push(m[0]);
}
console.log("cells dup r=", dupR.length, dupR.slice(0, 3));

const badRows = [];
for (const m of sheet.matchAll(/<row\b[^>]*>/g)) {
  if ((m[0].match(/\br="/g) || []).length > 1) badRows.push(m[0]);
}
console.log("rows dup r=", badRows.length);

const dim = sheet.match(/<dimension ref="([^"]+)"/)?.[1];
console.log("dimension", dim);

// Compare template vs rendered first 500 chars of sheetData
const tplData = tplSheet.match(/<sheetData[\s\S]*?<\/sheetData>/)?.[0]?.length;
const renData = sheet.match(/<sheetData[\s\S]*?<\/sheetData>/)?.[0]?.length;
console.log("sheetData tpl vs ren", tplData, renData);
