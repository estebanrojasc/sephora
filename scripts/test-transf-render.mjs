import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../src/features/records/types.ts";
import { buildRendicionPayload } from "../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");
const extraction = createEmptyExtraction();
extraction.n_recorrido.valor = "99999";
extraction.detalle_transferencias = [
  {
    no_fac: { valor: "F001", bbox: [0, 0, 0, 0] },
    valor: { valor: "150000", bbox: [0, 0, 0, 0] },
    cliente: { valor: "CLIENTE UNO", bbox: [0, 0, 0, 0] },
    banco: { valor: "SANTANDER", bbox: [0, 0, 0, 0] },
  },
  {
    no_fac: { valor: "F002", bbox: [0, 0, 0, 0] },
    valor: { valor: "250000", bbox: [0, 0, 0, 0] },
    cliente: { valor: "CLIENTE DOS", bbox: [0, 0, 0, 0] },
    banco: { valor: "BCI", bbox: [0, 0, 0, 0] },
  },
];

const record = {
  id: "test-transf",
  status: "saved",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  images: [],
  extraction,
};

const out = renderRendicionExcel(template, buildRendicionPayload(record));
writeFileSync("scripts/.tmp/rendicion-transf-test.xlsx", out);

const f = unzipSync(out);
const strings = [];
for (const m of new TextDecoder().decode(f["xl/sharedStrings.xml"]).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
  strings.push(m[1].replace(/<[^>]+>/g, ""));
}
const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);

function cellVal(inner, attrs) {
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && attrs.includes('t="s"')) return strings[parseInt(vm[1], 10)] ?? "";
  if (vm) return vm[1];
  const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
  return isT ? isT[1] : "";
}

console.log("=== Transferencias en output (filas 71-76) ===");
for (const m of sheet.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
  const row = parseInt(m[2], 10);
  if (row < 71 || row > 76) continue;
  const val = cellVal(m[4], m[3]);
  if (val && !val.includes("{{")) console.log(`${m[1]}${row}: ${val}`);
}

let stale = 0;
for (const m of sheet.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
  const row = parseInt(m[2], 10);
  if (row < 71 || row > 76) continue;
  const val = cellVal(m[4], m[3]);
  if (val.includes("{{")) {
    stale++;
    console.log("STALE", `${m[1]}${row}: ${val}`);
  }
}
console.log("stale transf placeholders:", stale);
