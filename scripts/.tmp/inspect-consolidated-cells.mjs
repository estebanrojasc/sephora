import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../../src/features/records/types.ts";
import { buildConsolidatedWorkbook } from "../../src/features/excel/build-consolidated.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");
const extraction = createEmptyExtraction();
extraction.rendicion.cheques_al_dia.valor = "111";
extraction.detalle_efectivo.total_billetes.valor = "888";
const record = {
  id: "t1",
  status: "saved",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  images: [],
  extraction,
};
const out = buildConsolidatedWorkbook(template, [record]);
const f = unzipSync(out);
const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);

function inspect(ref) {
  const m = sheet.match(new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)</c>)`));
  if (!m) return `${ref}: missing`;
  const body = m[2] ?? "";
  const shared = body.match(/<v>(\d+)<\/v>/)?.[1];
  const inline = body.match(/<t[^>]*>([^<]*)</)?.[1];
  return `${ref}: ${inline ?? (shared ? "shared#" + shared : "empty")}`;
}

console.log(inspect("B11"));
console.log(inspect("Q27"));
console.log(inspect("Q25"));
