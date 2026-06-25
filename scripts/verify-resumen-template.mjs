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
  ];
  extraction.detalle_transferencias = [
    {
      no_fac: { valor: "F001", bbox: [0, 0, 0, 0] },
      valor: { valor: "150000", bbox: [0, 0, 0, 0] },
      cliente: { valor: "CLIENTE UNO", bbox: [0, 0, 0, 0] },
      banco: { valor: "SANTANDER", bbox: [0, 0, 0, 0] },
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
  const strings = [];
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
  };
}

const ind = cellMap(individual["xl/worksheets/sheet1.xml"]);
const res = cellMap(consolidated["xl/worksheets/sheet1.xml"]);

const checks = [
  ["B1 conductor", ind.get("B1"), res.get("B1")],
  ["B2 auxiliar", ind.get("B2"), res.get("B2")],
  ["B5 recorrido", ind.get("B5"), res.get("B5")],
  ["B6 cant_fact", ind.get("B6"), res.get("B6")],
  ["B7 valor_total", ind.get("B7"), res.get("B7")],
  ["B9 billetes", ind.get("B9"), res.get("B9")],
  ["N23 fecha", ind.get("N23"), res.get("N23")],
  ["U23 cant_fact", ind.get("U23"), res.get("U23")],
  ["N37 chq banco", ind.get("N37"), res.get("N37")],
  ["O37 chq valor", ind.get("O37"), res.get("O37")],
  ["M73 transf cliente", ind.get("M73"), res.get("M73")],
  ["C1 conductor r2", "BOB", res.get("C1")],
  ["C5 recorrido r2", "222", res.get("C5")],
];

let ok = true;
for (const [label, expected, actual] of checks) {
  const pass = String(expected) === String(actual);
  if (!pass) ok = false;
  console.log(pass ? "OK" : "FAIL", label, expected, "vs", actual);
}

console.log("Resumen stale placeholders:", res.stale());
console.log(ok && res.stale() === 0 ? "PASS" : "FAIL");

writeFileSync("scripts/.tmp/consolidado-test.xlsx", buildConsolidatedWorkbook(template, [r1, r2]));
