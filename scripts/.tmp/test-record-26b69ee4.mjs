import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { buildRendicionPayload } from "../../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../../src/features/excel/render.ts";
import { splitChequesByTipo, chequeReferenceIso } from "../../src/features/records/cheque-utils.ts";

const extraction = {
  fecha: { valor: "30-06-2026", bbox: [280, 73, 407, 97] },
  conductor: { valor: "PEDRO", bbox: [0, 0, 0, 0] },
  auxiliar: { valor: "PERCY", bbox: [0, 0, 0, 0] },
  n_recorrido: { valor: "260006320", bbox: [0, 0, 0, 0] },
  patente: { valor: "SXSP - 53", bbox: [0, 0, 0, 0] },
  cant_fact: { valor: "5", bbox: [0, 0, 0, 0] },
  valor_total: { valor: "1.054.260", bbox: [0, 0, 0, 0] },
  rendicion: {
    efectivo_total: { valor: "593.260", bbox: [0, 0, 0, 0] },
    cheques_al_dia: { valor: "", bbox: [0, 0, 0, 0] },
    cheques_a_fecha: { valor: "461.001", bbox: [0, 0, 0, 0] },
    credito_vendedor: { valor: "", bbox: [0, 0, 0, 0] },
    retorno_total: { valor: "", bbox: [0, 0, 0, 0] },
    retorno_parcial: { valor: "", bbox: [0, 0, 0, 0] },
    n_c_negocio: { valor: "", bbox: [0, 0, 0, 0] },
    transferencia: { valor: "", bbox: [0, 0, 0, 0] },
    total: { valor: "1.054.261", bbox: [0, 0, 0, 0] },
  },
  detalles_cheques: [
    {
      fecha: { valor: "30-07-2026", bbox: [57, 437, 150, 461] },
      banco: { valor: "BCI", bbox: [150, 437, 250, 461] },
      valor: { valor: "368449", bbox: [250, 437, 350, 461] },
    },
    {
      fecha: { valor: "30-07-2026", bbox: [57, 461, 150, 485] },
      banco: { valor: "BCI", bbox: [150, 461, 250, 485] },
      valor: { valor: "92.552", bbox: [250, 461, 350, 485] },
    },
  ],
  total_cheques: { valor: "461.001", bbox: [0, 0, 0, 0] },
  n_c_rechazo_total: [],
  n_c_rechazo_parcial: [],
  n_c_por_negocios: [],
  detalle_transferencias: [],
  detalle_credito_vendedor: [],
  detalle_efectivo: {
    billetes: [],
    monedas: [],
    total_billetes: { valor: "592000", bbox: [0, 0, 0, 0] },
    total_monedas: { valor: "1260", bbox: [0, 0, 0, 0] },
    total_efectivo: { valor: "593260", bbox: [0, 0, 0, 0] },
  },
  total_n_c_rechazo_total: { valor: "", bbox: [0, 0, 0, 0] },
  total_n_c_rechazo_parcial: { valor: "", bbox: [0, 0, 0, 0] },
  total_n_c_por_negocios: { valor: "", bbox: [0, 0, 0, 0] },
  total_transferencias: { valor: "", bbox: [0, 0, 0, 0] },
  numero_deposito_en_efectivo: { valor: "", bbox: [0, 0, 0, 0] },
  monto_deposito_en_efectivo: { valor: "", bbox: [0, 0, 0, 0] },
  observaciones: { valor: "Ruta", bbox: [0, 0, 0, 0] },
  _meta: {
    bitacora: {
      bitacoraId: "388a3419-3c5e-4615-a498-07cdbb3a33b2",
      rowId: "d2c69ba8-7f86-4818-94e7-14a7cc9366aa",
      version: 1,
      matchScore: 60,
      suggested: {
        patente: "SXSP - 53",
        conductor: "Pedro",
        auxiliar: "Percy/ Victor",
        observaciones: "Ruta",
        sector: "Agro",
        recorrido: "260006320",
        n_factura: "5",
        total_factura: "1.054.260",
      },
      recognized: {
        patente: "STSP53",
        conductor: "Dudno",
        auxiliar: "Percy",
        observaciones: null,
        recorrido: "6320",
        n_factura: "5",
        total_factura: "1.054.260",
      },
      applied: { patente: true, observaciones: true, recorrido: true },
      excel: {
        patente: "SXSP - 53",
        conductor: "PEDRO",
        auxiliar: "PERCY",
        observaciones: "Ruta",
        sector: "Agro",
        recorrido: "260006320",
        n_factura: "5",
        total_factura: "1.054.260",
        conductor_inicial: "Dudno",
      },
    },
  },
};

const record = {
  id: "26b69ee4-7892-4c2c-b4a1-7a98acdeff28",
  status: "saved",
  createdAt: "2026-06-30T21:32:14.862Z",
  updatedAt: "2026-07-02T15:24:40.436Z",
  images: [],
  extraction,
};

const ref = chequeReferenceIso(extraction);
const split = splitChequesByTipo(extraction.detalles_cheques, ref);
console.log("=== CLASIFICACIÓN ===");
console.log("fecha referencia:", ref);
console.log("al_dia:", split.alDia.length, split.alDia);
console.log("a_fecha:", split.aFecha.length, split.aFecha);

const payload = buildRendicionPayload(record);
console.log("\n=== PAYLOAD cheques_a_fecha ===");
console.log(JSON.stringify(payload.lists.cheques_a_fecha, null, 2));
console.log("cheques_al_dia:", payload.lists.cheques_al_dia);

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");
const out = renderRendicionExcel(template, payload);
writeFileSync("scripts/.tmp/record-26b69ee4.xlsx", out);

const sheet = new TextDecoder().decode(unzipSync(out)["xl/worksheets/sheet1.xml"]);
const strs = [];
for (const m of new TextDecoder().decode(unzipSync(out)["xl/sharedStrings.xml"]).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g))
  strs.push(m[1].replace(/<[^>]+>/g, ""));

function getCell(ref) {
  const m = sheet.match(new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`));
  if (!m) return "(missing)";
  if (m[0].endsWith("/>")) return "(empty)";
  const inner = m[2] ?? "";
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && /t="s"/.test(m[1])) return strs[+vm[1]] ?? vm[1];
  const isT = inner.match(/<t[^>]*>([^<]*)<\/t>/);
  if (isT) return isT[1];
  const vn = inner.match(/<v>([^<]+)<\/v>/);
  return vn ? vn[1] : "(empty)";
}

console.log("\n=== CELDAS M/N/O filas 36-45 ===");
for (let r = 36; r <= 45; r++) {
  const m = getCell(`M${r}`), n = getCell(`N${r}`), o = getCell(`O${r}`);
  if (m !== "(missing)" || n !== "(missing)" || o !== "(missing)")
    console.log(`R${r}: M=${m} | N=${n} | O=${o}`);
}
