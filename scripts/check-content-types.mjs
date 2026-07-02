import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

for (const path of [
  "templates/RUTA CFT-ABL -2026.xlsx",
  "scripts/.tmp/consolidado-test.xlsx",
]) {
  const f = unzipSync(readFileSync(path));
  const ct = new TextDecoder().decode(f["[Content_Types].xml"]);
  const sheetParts = [...ct.matchAll(/PartName="(\/xl\/worksheets\/sheet\d+\.xml)"/g)].map(
    (m) => m[1]
  );
  const present = sheetParts.filter((p) => f[p.slice(1)]);
  const missing = sheetParts.filter((p) => !f[p.slice(1)]);
  console.log("\n", path);
  console.log("  sheet parts in CT:", sheetParts);
  console.log("  missing files:", missing);
  console.log("  worksheet keys:", Object.keys(f).filter((k) => k.includes("worksheets/sheet")));
}
