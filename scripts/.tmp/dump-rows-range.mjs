import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const file = process.argv[2] ?? "scripts/.tmp/audit-cons.xlsx";
const rows = (process.argv[3] ?? "76-79").split("-").map(Number);
const x = new TextDecoder().decode(
  unzipSync(readFileSync(file))["xl/worksheets/sheet1.xml"]
);

for (let r = rows[0]; r <= (rows[1] ?? rows[0]); r++) {
  const m = x.match(new RegExp(`<row\\b[^>]*\\br="${r}"[^>]*>[\\s\\S]*?<\\/row>`));
  if (!m) {
    console.log(`ROW ${r}: NOT FOUND`);
    continue;
  }
  const cells = [...m[0].matchAll(/\br="([A-Z]+)(\d+)"/g)].map((c) => `${c[1]}${c[2]}`);
  const mism = cells.filter((ref) => !ref.endsWith(String(r)));
  console.log(`ROW ${r}: ${cells.length} cells, mismatched: ${mism.join(", ") || "none"}`);
}
