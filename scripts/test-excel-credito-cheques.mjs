import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../src/features/records/types.ts";
import { buildRendicionPayload } from "../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function getCell(sheet, strings, ref) {
  const m = sheet.match(
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

function fechaCol(sheet, strings, row) {
  for (const col of ["K", "M"]) {
    const v = getCell(sheet, strings, `${col}${row}`);
    if (v && !v.includes("{{")) return { col, v };
  }
  return { col: "K", v: "" };
}

// --- Crédito: fila separadora vacía entre créditos y transferencia ---
const credExtraction = createEmptyExtraction();
credExtraction.n_recorrido.valor = "260006344";
credExtraction.detalle_credito_vendedor = [
  { cliente: { valor: "Dist. MENE Spa", bbox: [0, 0, 0, 0] }, no_fac: { valor: "605832", bbox: [0, 0, 0, 0] }, valor: { valor: "1441918", bbox: [0, 0, 0, 0] }, nro_vendedor: { valor: "69", bbox: [0, 0, 0, 0] } },
  { cliente: { valor: "Carlos Abarca", bbox: [0, 0, 0, 0] }, no_fac: { valor: "605790", bbox: [0, 0, 0, 0] }, valor: { valor: "639578", bbox: [0, 0, 0, 0] }, nro_vendedor: { valor: "70", bbox: [0, 0, 0, 0] } },
  { cliente: { valor: "HERMES LOPEZ", bbox: [0, 0, 0, 0] }, no_fac: { valor: "605741", bbox: [0, 0, 0, 0] }, valor: { valor: "1209230", bbox: [0, 0, 0, 0] }, nro_vendedor: { valor: "79", bbox: [0, 0, 0, 0] } },
  { cliente: { valor: "CO JUANTIA", bbox: [0, 0, 0, 0] }, no_fac: { valor: "605755", bbox: [0, 0, 0, 0] }, valor: { valor: "1237147", bbox: [0, 0, 0, 0] }, nro_vendedor: { valor: "79", bbox: [0, 0, 0, 0] } },
];
credExtraction.detalle_transferencias = [
  { cliente: { valor: "Minirosket natalia", bbox: [0, 0, 0, 0] }, no_fac: { valor: "605731", bbox: [0, 0, 0, 0] }, valor: { valor: "42098", bbox: [0, 0, 0, 0] }, banco: { valor: "Banco Estado", bbox: [0, 0, 0, 0] } },
];

const credFiles = unzipSync(
  renderRendicionExcel(
    template,
    buildRendicionPayload({
      id: "cred",
      status: "saved",
      createdAt: "",
      updatedAt: "",
      images: [],
      extraction: credExtraction,
    })
  )
);
const credStrings = [];
for (const m of new TextDecoder()
  .decode(credFiles["xl/sharedStrings.xml"])
  .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
  credStrings.push(m[1].replace(/<[^>]+>/g, ""));
}
const credSheet = new TextDecoder().decode(credFiles["xl/worksheets/sheet1.xml"]);

const credOk =
  getCell(credSheet, credStrings, "M71") === "Dist. MENE Spa" &&
  getCell(credSheet, credStrings, "M74") === "CO JUANTIA" &&
  getCell(credSheet, credStrings, "L71") === "260006344" &&
  getCell(credSheet, credStrings, "L74") === "260006344" &&
  getCell(credSheet, credStrings, "M75") === "" &&
  getCell(credSheet, credStrings, "L76") === "260006344" &&
  getCell(credSheet, credStrings, "M76") === "Minirosket natalia";

console.log(credOk ? "PASS credito separador" : "FAIL credito separador");
if (!credOk) {
  for (let r = 71; r <= 77; r++) {
    console.log(`  R${r} M=${getCell(credSheet, credStrings, `M${r}`) || "-"} L=${getCell(credSheet, credStrings, `L${r}`) || "-"}`);
  }
}

// --- Cheques al día ---
const chqExtraction = createEmptyExtraction();
chqExtraction.fecha.valor = "30/06/2026";
chqExtraction.detalles_cheques = [
  { fecha: { valor: "15/07/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "SANT", bbox: [0, 0, 0, 0] }, valor: { valor: "100", bbox: [0, 0, 0, 0] } },
  { fecha: { valor: "30/06/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "BCI", bbox: [0, 0, 0, 0] }, valor: { valor: "50", bbox: [0, 0, 0, 0] } },
  { fecha: { valor: "28/06/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "EST", bbox: [0, 0, 0, 0] }, valor: { valor: "75", bbox: [0, 0, 0, 0] } },
];

const chqPayload = buildRendicionPayload({
  id: "chq",
  status: "saved",
  createdAt: "",
  updatedAt: "",
  images: [],
  extraction: chqExtraction,
});

const chqFiles = unzipSync(renderRendicionExcel(template, chqPayload));
const chqStrings = [];
for (const m of new TextDecoder()
  .decode(chqFiles["xl/sharedStrings.xml"])
  .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
  chqStrings.push(m[1].replace(/<[^>]+>/g, ""));
}
const chqSheet = new TextDecoder().decode(chqFiles["xl/worksheets/sheet1.xml"]);

const r37 = fechaCol(chqSheet, chqStrings, 37);
const r38 = fechaCol(chqSheet, chqStrings, 38);
let aFechaVal = "";
for (let row = 39; row <= 42; row++) {
  const { v } = fechaCol(chqSheet, chqStrings, row);
  if (v.includes("15")) {
    aFechaVal = v;
    break;
  }
}

const chqOk =
  chqPayload.lists.cheques_al_dia.length === 2 &&
  chqPayload.lists.cheques_a_fecha.length === 1 &&
  (r37.v.includes("30") || r37.v.includes("28")) &&
  (r38.v.includes("30") || r38.v.includes("28")) &&
  r37.v !== r38.v &&
  aFechaVal.includes("15");

console.log(chqOk ? "PASS cheques al dia" : "FAIL cheques al dia", {
  alDia: chqPayload.lists.cheques_al_dia.length,
  aFecha: chqPayload.lists.cheques_a_fecha.length,
  r37: r37.v,
  r38: r38.v,
  aFechaVal,
});

process.exit(credOk && chqOk ? 0 : 1);
