import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const f = unzipSync(readFileSync("templates/RUTA CFT-ABL -2026.xlsx"));
const dec = new TextDecoder();
const strings = [];
for (const m of dec.decode(f["xl/sharedStrings.xml"]).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
  strings.push(m[1].replace(/<[^>]+>/g, ""));
}
const sheet = dec.decode(f["xl/worksheets/sheet1.xml"]);

function cellVal(inner, attrs) {
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && attrs.includes('t="s"')) return strings[parseInt(vm[1], 10)] ?? "";
  return "";
}

console.log("=== Placeholders en sharedStrings ===");
strings.forEach((s, i) => {
  if (s.includes("{{")) console.log(i, s);
});

console.log("\n=== Celdas con placeholder ===");
for (const m of sheet.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
  const val = cellVal(m[4], m[3]);
  if (val.includes("{{")) console.log(`${m[1]}${m[2]}: ${val}`);
}
