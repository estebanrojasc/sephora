import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../src/features/records/types.ts";
import { buildRendicionPayload } from "../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../src/features/excel/render.ts";

mkdirSync("scripts/.tmp", { recursive: true });

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");
const extraction = createEmptyExtraction();
extraction.n_recorrido.valor = "99999";
extraction.detalle_transferencias = [
  {
    no_fac: { valor: "F001", bbox: [0, 0, 0, 0] },
    valor: { valor: "150000", bbox: [0, 0, 0, 0] },
    cliente: { valor: "CLIENTE UNO", bbox: [0, 0, 0, 0] },
    banco: { valor: "VE", bbox: [0, 0, 0, 0] },
  },
  {
    no_fac: { valor: "F002", bbox: [0, 0, 0, 0] },
    valor: { valor: "250000", bbox: [0, 0, 0, 0] },
    cliente: { valor: "CLIENTE DOS", bbox: [0, 0, 0, 0] },
    banco: { valor: "S", bbox: [0, 0, 0, 0] },
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

function get(ref) {
  const re = new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`);
  const m = sheet.match(re);
  if (!m) return "(missing)";
  const attrs = m[1];
  const inner = m[2] ?? "";
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && attrs.includes('t="s"')) return strings[parseInt(vm[1], 10)] ?? "";
  if (vm) return vm[1];
  const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
  return isT ? isT[1] : "";
}

const checks = [
  ["M73 cliente", "CLIENTE UNO", get("M73")],
  ["P73 fac", "F001", get("P73")],
  ["T73 valor", "150000", get("T73")],
  ["U73 banco", "Voucher Banco Estado", get("U73")],
  ["M74 cliente", "CLIENTE DOS", get("M74")],
  ["U74 banco", "Banco Santander", get("U74")],
  ["O73 vacío", "", get("O73")],
];

let ok = true;
for (const [label, expected, actual] of checks) {
  const pass = String(expected) === String(actual);
  if (!pass) ok = false;
  console.log(pass ? "OK" : "FAIL", label, "expected", JSON.stringify(expected), "got", JSON.stringify(actual));
}
console.log(ok ? "PASS" : "FAIL");
