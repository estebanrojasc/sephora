import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const f = unzipSync(readFileSync("scripts/.tmp/test-full.xlsx"));
const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);

// Buscar etiquetas <row> con atributos duplicados
const rowTags = sheet.match(/<row\b[^>]*>/g) ?? [];
let dupes = 0;
for (const tag of rowTags) {
  const attrs = [...tag.matchAll(/\b([\w:]+)="/g)].map(m => m[1]);
  const seen = new Set();
  for (const a of attrs) {
    if (seen.has(a)) {
      console.log("DUPLICADO en:", tag.slice(0, 120));
      dupes++;
      break;
    }
    seen.add(a);
  }
}
if (dupes === 0) console.log("Sin duplicados en row tags (test-full.xlsx)");

// También verificar el template original
const tpl = unzipSync(readFileSync("templates/RUTA CFT-ABL -2026.xlsx"));
const tplSheet = new TextDecoder().decode(tpl["xl/worksheets/sheet1.xml"]);
const tplTags = tplSheet.match(/<row\b[^>]*>/g) ?? [];
console.log("\nEjemplo de row tag en plantilla:", tplTags.find(t => t.includes("dyDescent")));
