import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const f = unzipSync(readFileSync("templates/RUTA CFT-ABL -2026.xlsx"));
const dec = new TextDecoder();
const ss = dec.decode(f["xl/sharedStrings.xml"]);
const strings = [];
for (const m of ss.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
  strings.push(m[1].replace(/<[^>]+>/g, ""));
}
const sheet = dec.decode(f["xl/worksheets/sheet1.xml"]);

function cellVal(inner) {
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && inner.includes('t="s"')) return strings[parseInt(vm[1], 10)] ?? `s${vm[1]}`;
  if (vm) return vm[1];
  const im = inner.match(/<t[^>]*>([^<]*)<\/t>/);
  return im ? im[1] : "";
}

for (const m of sheet.matchAll(/<c r="([A-Z]+)(\d+)"[^>]*>([\s\S]*?)<\/c>/g)) {
  const col = m[1];
  const row = parseInt(m[2], 10);
  if (row > 30) continue;
  const val = cellVal(m[3]);
  if (!val) continue;
  console.log(`${col}${row}: ${val}`);
}
