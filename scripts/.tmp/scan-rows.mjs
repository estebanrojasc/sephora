import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const path = process.argv[2] ?? "scripts/.tmp/cons-multi.xlsx";
const s = new TextDecoder().decode(unzipSync(readFileSync(path))["xl/worksheets/sheet1.xml"]);
const rows = [...s.matchAll(/<row\b[^>]*\br="(\d+)"/g)].map((m) => +m[1]);
console.log("min", Math.min(...rows), "max", Math.max(...rows), "count", rows.length);
console.log("rows 30-70", rows.filter((r) => r >= 30 && r <= 70));
console.log("dim", s.match(/<dimension[^>]+>/)?.[0] ?? s.match(/dimension\s+ref="[^"]+"/)?.[0]);

for (const r of [37, 55, 56, 57, 100, 120]) {
  const m = s.match(new RegExp(`<row\\b[^>]*\\br="${r}"[^>]*>[\\s\\S]*?<\\/row>`));
  console.log(`\nROW ${r}:`, m ? m[0].slice(0, 400) : "NOT FOUND");
}
