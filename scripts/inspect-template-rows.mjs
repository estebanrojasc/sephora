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

for (const row of [71, 72, 73, 74, 75, 76]) {
  console.log(`\nRow ${row}:`);
  for (const col of ["L", "M", "P", "T", "U", "R"]) {
    console.log(`  ${col}${row}: ${get(`${col}${row}`)}`);
  }
}
