import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");
const f = unzipSync(template);
const strings = [];
for (const m of new TextDecoder()
  .decode(f["xl/sharedStrings.xml"])
  .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
  strings.push(m[1].replace(/<[^>]+>/g, ""));
}
const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);

function get(ref) {
  const re = new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`);
  const m = sheet.match(re);
  if (!m) return "(no cell)";
  const attrs = m[1];
  const inner = m[2] ?? "";
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && attrs.includes('t="s"')) return strings[parseInt(vm[1], 10)] ?? "";
  if (vm) return vm[1];
  const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
  return isT ? isT[1] : "(empty)";
}

for (let row = 35; row <= 42; row++) {
  const parts = [];
  for (const col of ["M", "N", "O", "P", "Q", "R", "S", "T", "U"]) {
    const v = get(`${col}${row}`);
    if (v && v !== "(empty)" && v !== "(no cell)") parts.push(`${col}=${v.slice(0, 30)}`);
  }
  console.log(`R${row}:`, parts.join(" | ") || "(empty row)");
}

console.log("\nRow exists:");
for (let row = 35; row <= 42; row++) {
  console.log(row, new RegExp(`<row\\b[^>]*\\br="${row}"`).test(sheet));
}
