import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const f = unzipSync(readFileSync("scripts/.tmp/test-full.xlsx"));
const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);
const strs = [];
for (const m of new TextDecoder()
  .decode(f["xl/sharedStrings.xml"])
  .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g))
  strs.push(m[1].replace(/<[^>]+>/g, ""));

function getCell(ref) {
  const re = new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`);
  const m = sheet.match(re);
  if (!m) return "(missing)";
  const attrs = m[1] ?? "";
  const inner = m[2] ?? "";
  if (m[0].endsWith("/>")) return "(empty)";
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && attrs.includes('t="s"')) return strs[parseInt(vm[1], 10)] ?? "";
  const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
  if (isT) return isT[1];
  const vn = inner.match(/<v>([^<]+)<\/v>/);
  return vn ? vn[1] : "(empty)";
}

// Buscar celdas NC (shifted de 65 a 65+delta)
console.log("=== Buscando celdas NC (rango 63-70) ===");
for (let r = 63; r <= 70; r++) {
  const q = getCell("Q" + r);
  const s = getCell("S" + r);
  const u = getCell("U" + r);
  if (q !== "(missing)" || s !== "(missing)" || u !== "(missing)") {
    console.log(`R${r}: Q=${q} S=${s} U=${u}`);
  }
}

// Ver todas las filas 60-80 columna O/Q/T/U
console.log("\n=== Filas 60-80 ===");
for (let r = 60; r <= 82; r++) {
  const l = getCell("L" + r);
  const m = getCell("M" + r);
  const q = getCell("Q" + r);
  const t = getCell("T" + r);
  const u = getCell("U" + r);
  const o = getCell("O" + r);
  const has = [l,m,q,t,u,o].some(v => v !== "(missing)" && v !== "(empty)");
  if (has) console.log(`R${r}: L=${l} M=${m} O=${o} Q=${q} T=${t} U=${u}`);
}
