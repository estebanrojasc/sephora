/**
 * Consolidado pesado: varios registros con cheques, crédito y transferencias.
 */
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../src/features/records/types.ts";
import { buildConsolidatedWorkbook } from "../src/features/excel/build-consolidated.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function richRecord(id, rec, conductor) {
  const e = createEmptyExtraction();
  e.conductor.valor = conductor;
  e.n_recorrido.valor = rec;
  e.fecha.valor = "30/06/2026";
  e.cant_fact.valor = "10";
  e.valor_total.valor = "1000000";
  e.rendicion.cheques_al_dia.valor = "150";
  e.rendicion.total.valor = "1000000";
  e.detalles_cheques = [
    { fecha: { valor: "30/06/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "BCI", bbox: [0, 0, 0, 0] }, valor: { valor: "50", bbox: [0, 0, 0, 0] } },
    { fecha: { valor: "29/06/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "BCI2", bbox: [0, 0, 0, 0] }, valor: { valor: "60", bbox: [0, 0, 0, 0] } },
    { fecha: { valor: "15/07/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "SANT", bbox: [0, 0, 0, 0] }, valor: { valor: "100", bbox: [0, 0, 0, 0] } },
  ];
  e.detalle_credito_vendedor = [
    { cliente: { valor: "Cliente A", bbox: [0, 0, 0, 0] }, no_fac: { valor: "1", bbox: [0, 0, 0, 0] }, valor: { valor: "100", bbox: [0, 0, 0, 0] }, nro_vendedor: { valor: "69", bbox: [0, 0, 0, 0] } },
    { cliente: { valor: "Cliente B", bbox: [0, 0, 0, 0] }, no_fac: { valor: "2", bbox: [0, 0, 0, 0] }, valor: { valor: "200", bbox: [0, 0, 0, 0] }, nro_vendedor: { valor: "70", bbox: [0, 0, 0, 0] } },
  ];
  e.detalle_transferencias = [
    { cliente: { valor: "Transf 1", bbox: [0, 0, 0, 0] }, no_fac: { valor: "T1", bbox: [0, 0, 0, 0] }, valor: { valor: "80", bbox: [0, 0, 0, 0] }, banco: { valor: "Estado", bbox: [0, 0, 0, 0] } },
    { cliente: { valor: "Transf 2", bbox: [0, 0, 0, 0] }, no_fac: { valor: "T2", bbox: [0, 0, 0, 0] }, valor: { valor: "90", bbox: [0, 0, 0, 0] }, banco: { valor: "Sant", bbox: [0, 0, 0, 0] } },
  ];
  return { id, status: "saved", createdAt: "", updatedAt: "", images: [], extraction: e };
}

const out = buildConsolidatedWorkbook(template, [
  richRecord("r1", "111", "ANA"),
  richRecord("r2", "222", "BOB"),
  richRecord("r3", "333", "CAR"),
]);

const f = unzipSync(out);
const sh = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);
const strings = [];
for (const m of new TextDecoder()
  .decode(f["xl/sharedStrings.xml"])
  .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
  strings.push(m[1].replace(/<[^>]+>/g, ""));
}

function cell(ref) {
  const m = sh.match(
    new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`)
  );
  if (!m) return "";
  const inner = m[2] ?? "";
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && m[1].includes('t="s"')) return strings[parseInt(vm[1], 10)] ?? "";
  const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
  if (isT) return isT[1];
  const vn = inner.match(/<v>([^<]+)<\/v>/);
  return vn ? vn[1] : "";
}

let ph = 0;
for (const m of sh.matchAll(/<c r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
  const inner = m[3];
  const vm = inner.match(/<v>(\d+)<\/v>/);
  let val = "";
  if (vm && m[2].includes('t="s"')) val = strings[parseInt(vm[1], 10)] ?? "";
  const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
  if (isT) val = isT[1];
  if (val.includes("{{")) ph++;
}

const ok =
  out.byteLength > 30_000 &&
  ph === 0 &&
  cell("B1") === "ANA" &&
  cell("C1") === "BOB" &&
  cell("M40") !== "" &&
  sh.includes("CREDITO") &&
  sh.includes("TRANSFERENCIA") &&
  (sh.includes('ref="I39:I46"') || sh.includes('si="6"'));

console.log(ok ? "PASS heavy consolidated" : "FAIL heavy consolidated", {
  bytes: out.byteLength,
  placeholders: ph,
  B1: cell("B1"),
  M40: cell("M40"),
  R72: cell("R72"),
  sharedFormula: sh.includes('ref="I39:I46"') || sh.includes('si="6"'),
});

process.exit(ok ? 0 : 1);
