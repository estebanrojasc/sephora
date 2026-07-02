import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const x = new TextDecoder().decode(
  unzipSync(readFileSync("scripts/.tmp/audit-cons.xlsx"))["xl/worksheets/sheet1.xml"]
);

for (const r of [70, 71, 72, 73, 74, 75, 103, 104, 105]) {
  const m = x.match(new RegExp(`<row\\b[^>]*\\br="${r}"[^>]*>[\\s\\S]*?<\\/row>`));
  if (!m) { console.log(`ROW ${r}: NOT FOUND`); continue; }
  const cells = [...m[0].matchAll(/<c r="([A-Z]+)(\d+)"/g)].map((c) => c[0]);
  console.log(`ROW ${r} (${cells.length} cells):`, cells.slice(0, 8).join(" "), cells.length > 8 ? "..." : "");
}
