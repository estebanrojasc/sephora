import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../src/features/records/types.ts";
import { buildRendicionPayload } from "../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");
const e = createEmptyExtraction();
e.detalles_cheques = [
  { fecha: { valor: "30/06/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "BCI", bbox: [0, 0, 0, 0] }, valor: { valor: "50", bbox: [0, 0, 0, 0] } },
  { fecha: { valor: "29/06/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "BCI2", bbox: [0, 0, 0, 0] }, valor: { valor: "60", bbox: [0, 0, 0, 0] } },
  { fecha: { valor: "15/07/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "SANT", bbox: [0, 0, 0, 0] }, valor: { valor: "100", bbox: [0, 0, 0, 0] } },
];
const out = renderRendicionExcel(
  template,
  buildRendicionPayload({ id: "x", status: "saved", createdAt: "", updatedAt: "", images: [], extraction: e })
);
const sheet = new TextDecoder().decode(unzipSync(out)["xl/worksheets/sheet1.xml"]);
for (const r of [37, 38, 39, 40, 41, 42]) {
  const m = sheet.match(new RegExp(`<row\\b[^>]*\\br="${r}"[^>]*>[\\s\\S]*?</row>`));
  console.log(`\n--- ROW ${r} ---`);
  console.log(m?.[0]?.slice(0, 500) ?? "(missing)");
}
