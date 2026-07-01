import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const t = unzipSync(readFileSync("templates/RUTA CFT-ABL -2026.xlsx"));
const sheet = new TextDecoder().decode(t["xl/worksheets/sheet1.xml"]);
const ss = new TextDecoder().decode(t["xl/sharedStrings.xml"]);
const placeholders = ["cred_cliente", "cred_fac", "transf_cliente", "transf_fac"];
for (const ph of placeholders) {
  let idx = -1;
  let i = 0;
  for (const m of ss.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    if (m[1].replace(/<[^>]+>/g, "") === `{{${ph}}}`) idx = i;
    i++;
  }
  console.log(ph, "idx", idx);
  if (idx < 0) continue;
  for (const m of sheet.matchAll(/<c r="([A-Z]+)(\d+)"[^>]*>\s*<v>(\d+)<\/v>/g)) {
    if (parseInt(m[3], 10) === idx) console.log("  at", m[1] + m[2]);
  }
}
