/**
 * Lista placeholder → celdas en la plantilla (sharedStrings e inlineStr).
 * Uso: npx tsx scripts/audit-template-placeholders.mjs
 */
import { readFileSync } from "node:fs";
import { discoverPlaceholderCells } from "../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");
const { unzipSync } = await import("fflate");
const f = unzipSync(template);
const strings = [];
for (const m of new TextDecoder()
  .decode(f["xl/sharedStrings.xml"])
  .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
  strings.push(m[1].replace(/<[^>]+>/g, ""));
}
const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);
const map = discoverPlaceholderCells(sheet, strings);

const keys = [...map.keys()].sort();
console.log(`=== ${keys.length} placeholders en plantilla ===\n`);
for (const key of keys) {
  console.log(`${key}`);
  for (const ref of map.get(key) ?? []) console.log(`  ${ref}`);
}
