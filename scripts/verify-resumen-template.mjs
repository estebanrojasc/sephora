import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../src/features/records/types.ts";
import { buildConsolidatedWorkbook } from "../src/features/excel/build-consolidated.ts";
import { buildRendicionPayload } from "../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function mockRecord(id, rec, conductor, extra = {}) {
  const extraction = createEmptyExtraction();
  extraction.conductor.valor = conductor;
  extraction.n_recorrido.valor = rec;
  extraction.fecha.valor = "24/06/2026";
  extraction.auxiliar.valor = "AUX " + conductor;
  extraction.cant_fact.valor = "10";
  extraction.valor_total.valor = "1000000";
  extraction.rendicion.efectivo_total.valor = "500000";
  extraction.detalle_efectivo.total_billetes.valor = "450000";
  extraction.detalle_efectivo.total_monedas.valor = "50000";
  extraction.rendicion.cheques_al_dia.valor = "300000";
  extraction.rendicion.total.valor = "1000000";
  extraction.detalles_cheques = [
    {
      fecha: { valor: "01/01/2026", bbox: [0, 0, 0, 0] },
      banco: { valor: "SANTANDER", bbox: [0, 0, 0, 0] },
      valor: { valor: "100000", bbox: [0, 0, 0, 0] },
    },
    {
      fecha: { valor: "02/01/2026", bbox: [0, 0, 0, 0] },
      banco: { valor: "BCI", bbox: [0, 0, 0, 0] },
      valor: { valor: "200000", bbox: [0, 0, 0, 0] },
    },
  ];
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
  Object.assign(extraction, extra);
  return {
    id,
    status: "saved",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    images: [],
    extraction,
  };
}

const r1 = mockRecord("r1", "111", "ANA");
const r2 = mockRecord("r2", "222", "BOB");

const individual = unzipSync(
  renderRendicionExcel(template, buildRendicionPayload(r1))
);
const consolidated = unzipSync(
  buildConsolidatedWorkbook(template, [r1, r2])
);

function cellMap(path) {
  const sheet = new TextDecoder().decode(path);
  return {
    get(ref) {
      const re = new RegExp(
        `<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`
      );
      const m = sheet.match(re);
      if (!m) return "";
      const inner = m[2] ?? "";
      const vm = inner.match(/<v>([^<]+)<\/v>/);
      if (vm) return vm[1];
      const tm = inner.match(/<t[^>]*>([^<]*)<\/t>/);
      return tm?.[1] ?? "";
    },
    stale() {
      return (sheet.match(/\{\{/g) ?? []).length;
    },
    hasRow(row) {
      return new RegExp(`<row\\b[^>]*\\br="${row}"`).test(sheet);
    },
  };
}

const ind = cellMap(individual["xl/worksheets/sheet1.xml"]);
const res = cellMap(consolidated["xl/worksheets/sheet1.xml"]);

const checks = [
  ["B6 cant_fact sum", "20", res.get("B6")],
  ["N37 chq row1", "SANTANDER", res.get("N37")],
  ["N38 chq row2", "BCI", res.get("N38")],
  ["N39 chq row3 (2do reg)", "SANTANDER", res.get("N39")],
];

let ok = true;
for (const [label, expected, actual] of checks) {
  const pass = String(expected) === String(actual);
  if (!pass) ok = false;
  console.log(pass ? "OK" : "FAIL", label, "expected", expected, "got", actual);
}

const stale = res.stale();
const expandedCheques = res.hasRow(39);
const expandedTransf = res.hasRow(76);
console.log("Resumen stale placeholders:", stale);
console.log("4 cheques -> row 39:", expandedCheques);
console.log("4 transferencias -> row 76:", expandedTransf);
console.log(
  ok && stale === 0 && expandedCheques && expandedTransf ? "PASS" : "FAIL"
);

writeFileSync(
  "scripts/.tmp/consolidado-test.xlsx",
  buildConsolidatedWorkbook(template, [r1, r2])
);
