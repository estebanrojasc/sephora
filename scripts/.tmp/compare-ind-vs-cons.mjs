/**
 * Compara individual vs consolidado con el registro real + registros pesados.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { buildRendicionPayload } from "../../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel as renderInd } from "../../src/features/excel/render.ts";
import { buildConsolidatedWorkbook } from "../../src/features/excel/build-consolidated.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

const pedroRecord = {
  id: "26b69ee4-7892-4c2c-b4a1-7a98acdeff28",
  status: "saved",
  createdAt: "2026-06-30T21:32:14.862Z",
  updatedAt: "2026-07-02T15:24:40.436Z",
  images: [],
  extraction: {
    fecha: { valor: "30-06-2026", bbox: [0, 0, 0, 0] },
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
      { fecha: { valor: "30-07-2026", bbox: [0, 0, 0, 0] }, banco: { valor: "BCI", bbox: [0, 0, 0, 0] }, valor: { valor: "368449", bbox: [0, 0, 0, 0] } },
      { fecha: { valor: "30-07-2026", bbox: [0, 0, 0, 0] }, banco: { valor: "BCI", bbox: [0, 0, 0, 0] }, valor: { valor: "92.552", bbox: [0, 0, 0, 0] } },
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
        bitacoraId: "x", rowId: "y", version: 1, matchScore: 60,
        suggested: { patente: "SXSP - 53", conductor: "Pedro", auxiliar: "Percy", observaciones: "Ruta", sector: "Agro", recorrido: "260006320", n_factura: "5", total_factura: "1.054.260" },
        recognized: { patente: "STSP53", conductor: "Dudno", auxiliar: "Percy", observaciones: null, recorrido: "6320", n_factura: "5", total_factura: "1.054.260" },
        applied: { patente: true, observaciones: true, recorrido: true },
        excel: { patente: "SXSP - 53", conductor: "PEDRO", auxiliar: "PERCY", observaciones: "Ruta", sector: "Agro", recorrido: "260006320", n_factura: "5", total_factura: "1.054.260", conductor_inicial: "Dudno" },
      },
    },
  },
};

// Registro pesado: muchos rechazos (como el export roto)
function heavyRecord(id, rec) {
  return {
    id, status: "saved", createdAt: "", updatedAt: "", images: [],
    extraction: {
      fecha: { valor: "30-06-2026", bbox: [0,0,0,0] },
      conductor: { valor: "CRISTIAN", bbox: [0,0,0,0] },
      n_recorrido: { valor: rec, bbox: [0,0,0,0] },
      cant_fact: { valor: "5", bbox: [0,0,0,0] },
      valor_total: { valor: "1000000", bbox: [0,0,0,0] },
      rendicion: {
        efectivo_total: { valor: "100", bbox: [0,0,0,0] },
        cheques_al_dia: { valor: "", bbox: [0,0,0,0] },
        cheques_a_fecha: { valor: "127092", bbox: [0,0,0,0] },
        credito_vendedor: { valor: "", bbox: [0,0,0,0] },
        retorno_total: { valor: "", bbox: [0,0,0,0] },
        retorno_parcial: { valor: "", bbox: [0,0,0,0] },
        n_c_negocio: { valor: "", bbox: [0,0,0,0] },
        transferencia: { valor: "", bbox: [0,0,0,0] },
        total: { valor: "1000000", bbox: [0,0,0,0] },
      },
      detalles_cheques: [
        { fecha: { valor: "30-07-2026", bbox: [0,0,0,0] }, banco: { valor: "SANTANDER", bbox: [0,0,0,0] }, valor: { valor: "127092", bbox: [0,0,0,0] } },
      ],
      n_c_rechazo_total: Array.from({ length: 17 }, (_, i) => ({
        no_fac: { valor: String(605655 + i), bbox: [0,0,0,0] },
        valor: { valor: String(10000 + i), bbox: [0,0,0,0] },
      })),
      n_c_rechazo_parcial: [],
      n_c_por_negocios: [],
      detalle_transferencias: [],
      detalle_credito_vendedor: [],
      detalle_efectivo: { billetes: [], monedas: [], total_billetes: { valor: "", bbox: [0,0,0,0] }, total_monedas: { valor: "", bbox: [0,0,0,0] }, total_efectivo: { valor: "100", bbox: [0,0,0,0] } },
      total_n_c_rechazo_total: { valor: "17", bbox: [0,0,0,0] },
      total_n_c_rechazo_parcial: { valor: "", bbox: [0,0,0,0] },
      total_n_c_por_negocios: { valor: "", bbox: [0,0,0,0] },
      total_transferencias: { valor: "", bbox: [0,0,0,0] },
      numero_deposito_en_efectivo: { valor: "", bbox: [0,0,0,0] },
      monto_deposito_en_efectivo: { valor: "", bbox: [0,0,0,0] },
      observaciones: { valor: "", bbox: [0,0,0,0] },
      _meta: { bitacora: { bitacoraId: "x", rowId: "y", version: 1, matchScore: 0, suggested: {}, recognized: {}, applied: {}, excel: { conductor: "CRISTIAN", recorrido: rec, n_factura: "5", total_factura: "1000000" } } },
    },
  };
}

const records = [
  heavyRecord("h1", "260006341"),
  heavyRecord("h2", "260006342"),
  { ...heavyRecord("h3", "260006343"), extraction: { ...heavyRecord("h3", "260006343").extraction,
    detalles_cheques: [{ fecha: { valor: "30-07-2026", bbox: [0,0,0,0] }, banco: { valor: "ITAU", bbox: [0,0,0,0] }, valor: { valor: "972618", bbox: [0,0,0,0] } }],
    rendicion: { ...heavyRecord("h3", "260006343").extraction.rendicion, cheques_a_fecha: { valor: "972618", bbox: [0,0,0,0] } },
  }},
  pedroRecord,
];

function inspectSheet(bytes, label) {
  const sheet = new TextDecoder().decode(unzipSync(bytes)["xl/worksheets/sheet1.xml"]);
  const strs = [];
  for (const m of new TextDecoder().decode(unzipSync(bytes)["xl/sharedStrings.xml"]).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g))
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

  console.log(`\n=== ${label} ===`);
  // buscar filas con datos en O en rango cheques
  for (let r = 36; r <= 70; r++) {
    const m = getCell(`M${r}`), n = getCell(`N${r}`), o = getCell(`O${r}`);
    const hasData = (v) => v !== "(missing)" && v !== "(empty)" && v !== "Fecha" && v !== "Banco" && v !== "Valor" && !v.includes("TOTAL");
    if (hasData(m) || hasData(n) || hasData(o))
      console.log(`  R${r}: M=${m} | N=${n} | O=${o}`);
  }
}

const ind = renderInd(template, buildRendicionPayload(pedroRecord));
writeFileSync("scripts/.tmp/ind-pedro.xlsx", ind);
inspectSheet(ind, "INDIVIDUAL pedro");

const cons1 = buildConsolidatedWorkbook(template, [pedroRecord]);
writeFileSync("scripts/.tmp/cons-1pedro.xlsx", cons1);
inspectSheet(cons1, "CONSOLIDADO 1 registro (pedro)");

const consMulti = buildConsolidatedWorkbook(template, records);
writeFileSync("scripts/.tmp/cons-multi.xlsx", consMulti);
inspectSheet(consMulti, "CONSOLIDADO 4 registros");
