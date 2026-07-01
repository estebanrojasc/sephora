import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const sheet = new TextDecoder().decode(
  unzipSync(readFileSync("templates/RUTA CFT-ABL -2026.xlsx"))[
    "xl/worksheets/sheet1.xml"
  ]
);
for (const row of [38, 72, 75]) {
  const m = sheet.match(
    new RegExp(`<row\\b[^>]*\\br="${row}"[^>]*>[\\s\\S]*?</row>`)
  );
  console.log(`\n--- Row ${row} ---`);
  console.log(m?.[0]?.slice(0, 500) ?? "missing");
}
