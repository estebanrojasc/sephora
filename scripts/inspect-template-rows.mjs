import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const tpl = unzipSync(readFileSync("templates/RUTA CFT-ABL -2026.xlsx"));
const sheet = new TextDecoder().decode(tpl["xl/worksheets/sheet1.xml"]);

for (const r of [37, 38, 39, 40]) {
  const re = new RegExp(`<row\\b[^>]*\\br="${r}"[^>]*>[\\s\\S]*?<\\/row>`);
  const xml = sheet.match(re)?.[0] ?? "(not found)";
  console.log(`\n=== TEMPLATE ROW ${r} ===`);
  console.log(xml.slice(0, 700));
}

// Specific cells M, N, O in rows 37-40
console.log("\n=== CÉLULAS M39, N39, O39 ===");
for (const ref of ["M39", "N39", "O39"]) {
  const re = new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`);
  const m = sheet.match(re);
  if (!m) { console.log(`${ref}: NOT FOUND`); continue; }
  console.log(`${ref}: attrs="${m[1]}" inner="${m[2] ?? ""}"`);
}
