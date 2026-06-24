import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const sheet = new TextDecoder().decode(
  unzipSync(readFileSync("templates/RUTA CFT-ABL -2026.xlsx"))["xl/worksheets/sheet1.xml"]
);

for (const ref of ["L37", "A71", "S71", "B72", "S73", "N27", "N34"]) {
  const idx = sheet.indexOf(`r="${ref}"`);
  console.log(
    ref,
    idx >= 0 ? sheet.slice(idx, idx + 150).replace(/\s+/g, " ") : "NOT FOUND"
  );
}
