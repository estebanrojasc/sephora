import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../src/features/records/types.ts";
import { buildRendicionPayload } from "../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function getCell(sheet, ref) {
  const m = sheet.match(
    new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`)
  );
  if (!m) return "";
  const inner = m[2] ?? "";
  return (
    inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/)?.[1] ??
    inner.match(/<v>([^<]*)<\/v>/)?.[1] ??
    ""
  );
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

const credSheet = new TextDecoder().decode(
  unzipSync(
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
  )["xl/worksheets/sheet1.xml"]
);

const credOk =
  getCell(credSheet, "M71") === "Dist. MENE Spa" &&
  getCell(credSheet, "M74") === "CO JUANTIA" &&
  getCell(credSheet, "M75") === "" &&
  getCell(credSheet, "L76") === "260006344" &&
  getCell(credSheet, "M76") === "Minirosket natalia";

console.log(credOk ? "PASS credito separador" : "FAIL credito separador");
if (!credOk) {
  for (let r = 71; r <= 77; r++) {
    console.log(`  R${r} M=${getCell(credSheet, `M${r}`) || "-"} L=${getCell(credSheet, `L${r}`) || "-"}`);
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

const chqSheet = new TextDecoder().decode(
  unzipSync(renderRendicionExcel(template, chqPayload))[
    "xl/worksheets/sheet1.xml"
  ]
);

const chqOk =
  chqPayload.lists.cheques_al_dia.length === 2 &&
  chqPayload.lists.cheques_a_fecha.length === 1 &&
  getCell(chqSheet, "M37").includes("15") &&
  getCell(chqSheet, "M39").includes("30") &&
  getCell(chqSheet, "M40").includes("28");

console.log(chqOk ? "PASS cheques al dia" : "FAIL cheques al dia", {
  alDia: chqPayload.lists.cheques_al_dia.length,
  aFecha: chqPayload.lists.cheques_a_fecha.length,
  r37: getCell(chqSheet, "M37"),
  r39: getCell(chqSheet, "M39"),
  r40: getCell(chqSheet, "M40"),
});

process.exit(credOk && chqOk ? 0 : 1);
