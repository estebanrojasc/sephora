import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const f = unzipSync(readFileSync("templates/RUTA CFT-ABL -2026.xlsx"));
const dec = new TextDecoder();
const strings = [];
for (const m of dec.decode(f["xl/sharedStrings.xml"]).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
  strings.push(m[1].replace(/<[^>]+>/g, ""));
}
const sheet = dec.decode(f["xl/worksheets/sheet1.xml"]);

function cellVal(inner, attrs) {
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && (attrs.includes('t="s"') || inner.includes('t="s"'))) {
    return strings[parseInt(vm[1], 10)] ?? `?${vm[1]}`;
  }
  if (vm) return `#${vm[1]}`;
  const im = inner.match(/<t[^>]*>([^<]*)<\/t>/);
  if (im) return im[1];
  const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
  return isT ? isT[1] : "";
}

console.log("=== transf/moneda/billete/chq in sharedStrings ===");
strings.forEach((s, i) => {
  if (/transf|billete|moneda|chq_/i.test(s)) console.log(`${i}: ${s}`);
});

console.log("\n=== Cells con esos placeholders (sheet1) ===");
for (const m of sheet.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
  const val = cellVal(m[4], m[3]);
  if (/transf|billete|moneda|chq_/i.test(val) || val.includes("{{")) {
    if (/transf|billete|moneda|chq_|{{/.test(val)) {
      console.log(`${m[1]}${m[2]}: ${val}`);
    }
  }
}

console.log("\n=== Rows 71-75 all non-empty ===");
for (const m of sheet.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
  const row = parseInt(m[2], 10);
  if (row < 71 || row > 75) continue;
  const val = cellVal(m[4], m[3]);
  if (val) console.log(`${m[1]}${row}: ${val}`);
}
