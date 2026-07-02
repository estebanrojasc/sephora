import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const f = unzipSync(readFileSync("templates/RUTA CFT-ABL -2026.xlsx"));
const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);
const strs = [];
for (const m of new TextDecoder().decode(f["xl/sharedStrings.xml"]).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g))
  strs.push(m[1].replace(/<[^>]+>/g, ""));

for (let r = 39; r <= 50; r++) {
  for (const c of ["M", "N", "O"]) {
    const m = sheet.match(new RegExp(`<c r="${c}${r}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`));
    if (!m) continue;
    const inner = m[2] ?? "";
    const vm = inner.match(/<v>(\d+)<\/v>/);
    let val = "";
    if (vm && /t="s"/.test(m[1])) val = strs[+vm[1]] ?? "";
    if (val) console.log(`${c}${r}: ${val}`);
  }
}
