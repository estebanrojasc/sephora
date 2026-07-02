import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const path = process.argv[2] ?? "RUTA CFT-ABL 30-06-2026 (15).xlsx";
const f = unzipSync(readFileSync(path));
const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);

for (const r of [37, 38, 39, 40, 55, 56, 57, 58, 82, 83, 84]) {
  const re = new RegExp(`<row\\b[^>]*\\br="${r}"[^>]*>[\\s\\S]*?<\\/row>`);
  const m = sheet.match(re);
  console.log(`\n=== ROW ${r} ===`);
  console.log(m ? m[0] : "(not found)");
}
