import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const f = unzipSync(readFileSync("templates/RUTA CFT-ABL -2026.xlsx"));
const dec = new TextDecoder();
const strings = [];
for (const m of dec.decode(f["xl/sharedStrings.xml"]).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
  strings.push(m[1].replace(/<[^>]+>/g, ""));
}
const sheet = dec.decode(f["xl/worksheets/sheet1.xml"]);

const placeholderIdx = new Set();
strings.forEach((s, i) => {
  if (/^\{\{[\w.]+\}\}$/.test(s) || /^\{\{[\w_]+\}\}$/.test(s)) placeholderIdx.add(i);
});

console.log("=== Celdas con placeholder (por ref) ===");
for (const m of sheet.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
  const inner = m[4];
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (!vm || !m[3].includes('t="s"')) continue;
  const idx = parseInt(vm[1], 10);
  if (!placeholderIdx.has(idx)) continue;
  console.log(`${m[1]}${m[2]}: ${strings[idx]}`);
}
