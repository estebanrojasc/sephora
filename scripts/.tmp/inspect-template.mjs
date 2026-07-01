import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const t = unzipSync(readFileSync("templates/RUTA CFT-ABL -2026.xlsx"));
const sheet = new TextDecoder().decode(t["xl/worksheets/sheet1.xml"]);
for (const row of [9, 11, 21, 22, 37, 39, 71, 72, 73, 74]) {
  const m = sheet.match(
    new RegExp(`<row\\b[^>]*\\br="${row}"[^>]*>[\\s\\S]*?</row>`)
  );
  console.log("Row", row, m ? `exists (${m[0].length} chars)` : "MISSING");
}
const ss = new TextDecoder().decode(t["xl/sharedStrings.xml"]);
for (const ph of [
  "extraction.rendicion.cheques_al_dia",
  "cred_cliente",
  "detalles_cheques.total_billetes",
]) {
  console.log("placeholder", ph, ss.includes(ph));
}
