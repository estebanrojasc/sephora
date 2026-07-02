import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const s = new TextDecoder().decode(unzipSync(readFileSync("scripts/.tmp/cons-multi.xlsx"))["xl/worksheets/sheet1.xml"]);
const strs = [];
for (const m of new TextDecoder().decode(unzipSync(readFileSync("scripts/.tmp/cons-multi.xlsx"))["xl/sharedStrings.xml"]).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g))
  strs.push(m[1].replace(/<[^>]+>/g, ""));

function cellVal(ref) {
  const m = s.match(new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`));
  if (!m) return null;
  if (m[0].endsWith("/>")) return "";
  const inner = m[2] ?? "";
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && /t="s"/.test(m[1])) return strs[+vm[1]] ?? "";
  const isT = inner.match(/<t[^>]*>([^<]*)<\/t>/);
  if (isT) return isT[1];
  const vn = inner.match(/<v>([^<]+)<\/v>/);
  return vn ? vn[1] : "";
}

const targets = new Set(["368449", "127092", "972618", "92552", "30-07-2026", "BCI", "SANTANDER", "ITAU"]);

console.log("=== Celdas M/N/O con datos de cheques ===");
for (let r = 1; r <= 162; r++) {
  for (const c of ["M", "N", "O"]) {
    const v = cellVal(`${c}${r}`);
    if (v && targets.has(v)) console.log(`${c}${r} = ${v}`);
  }
}

// filas con solo O y valor numerico grande
console.log("\n=== Filas con SOLO celda O (patrón roto) ===");
for (const m of s.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const row = m[1];
  const body = m[2];
  const cells = [...body.matchAll(/<c r="([A-Z]+)(\d+)"/g)];
  if (cells.length === 1 && cells[0][1] === "O") {
    const v = cellVal(`O${row}`);
    if (v && /^\d+$/.test(v)) console.log(`  R${row} solo O=${v}`);
  }
}
