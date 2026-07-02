/**
 * Consolidado: cheques a fecha con fecha/banco/valor en multi-registro,
 * y paridad con individual en un solo registro.
 */
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { buildRendicionPayload } from "../src/features/excel/build-rendicion.ts";
import { buildConsolidatedWorkbook } from "../src/features/excel/build-consolidated.ts";
import { renderRendicionExcel } from "../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function pedroRecord() {
  return {
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
        {
          fecha: { valor: "30-07-2026", bbox: [0, 0, 0, 0] },
          banco: { valor: "BCI", bbox: [0, 0, 0, 0] },
          valor: { valor: "368449", bbox: [0, 0, 0, 0] },
        },
        {
          fecha: { valor: "30-07-2026", bbox: [0, 0, 0, 0] },
          banco: { valor: "BCI", bbox: [0, 0, 0, 0] },
          valor: { valor: "92.552", bbox: [0, 0, 0, 0] },
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
          bitacoraId: "x",
          rowId: "y",
          version: 1,
          matchScore: 60,
          suggested: {
            patente: "SXSP - 53",
            conductor: "Pedro",
            auxiliar: "Percy",
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
    },
  };
}

function heavyRecord(id, rec, chqValor, banco = "SANTANDER") {
  return {
    id,
    status: "saved",
    createdAt: "",
    updatedAt: "",
    images: [],
    extraction: {
      fecha: { valor: "30-06-2026", bbox: [0, 0, 0, 0] },
      conductor: { valor: "CRISTIAN", bbox: [0, 0, 0, 0] },
      n_recorrido: { valor: rec, bbox: [0, 0, 0, 0] },
      cant_fact: { valor: "5", bbox: [0, 0, 0, 0] },
      valor_total: { valor: "1000000", bbox: [0, 0, 0, 0] },
      rendicion: {
        efectivo_total: { valor: "100", bbox: [0, 0, 0, 0] },
        cheques_al_dia: { valor: "", bbox: [0, 0, 0, 0] },
        cheques_a_fecha: { valor: chqValor, bbox: [0, 0, 0, 0] },
        credito_vendedor: { valor: "", bbox: [0, 0, 0, 0] },
        retorno_total: { valor: "", bbox: [0, 0, 0, 0] },
        retorno_parcial: { valor: "", bbox: [0, 0, 0, 0] },
        n_c_negocio: { valor: "", bbox: [0, 0, 0, 0] },
        transferencia: { valor: "", bbox: [0, 0, 0, 0] },
        total: { valor: "1000000", bbox: [0, 0, 0, 0] },
      },
      detalles_cheques: [
        {
          fecha: { valor: "30-07-2026", bbox: [0, 0, 0, 0] },
          banco: { valor: banco, bbox: [0, 0, 0, 0] },
          valor: { valor: chqValor, bbox: [0, 0, 0, 0] },
        },
      ],
      n_c_rechazo_total: Array.from({ length: 17 }, (_, i) => ({
        no_fac: { valor: String(605655 + i), bbox: [0, 0, 0, 0] },
        valor: { valor: String(10000 + i), bbox: [0, 0, 0, 0] },
      })),
      n_c_rechazo_parcial: [],
      n_c_por_negocios: [],
      detalle_transferencias: [],
      detalle_credito_vendedor: [],
      detalle_efectivo: {
        billetes: [],
        monedas: [],
        total_billetes: { valor: "", bbox: [0, 0, 0, 0] },
        total_monedas: { valor: "", bbox: [0, 0, 0, 0] },
        total_efectivo: { valor: "100", bbox: [0, 0, 0, 0] },
      },
      total_n_c_rechazo_total: { valor: "17", bbox: [0, 0, 0, 0] },
      total_n_c_rechazo_parcial: { valor: "", bbox: [0, 0, 0, 0] },
      total_n_c_por_negocios: { valor: "", bbox: [0, 0, 0, 0] },
      total_transferencias: { valor: "", bbox: [0, 0, 0, 0] },
      numero_deposito_en_efectivo: { valor: "", bbox: [0, 0, 0, 0] },
      monto_deposito_en_efectivo: { valor: "", bbox: [0, 0, 0, 0] },
      observaciones: { valor: "", bbox: [0, 0, 0, 0] },
      _meta: {
        bitacora: {
          bitacoraId: "x",
          rowId: "y",
          version: 1,
          matchScore: 0,
          suggested: {},
          recognized: {},
          applied: {},
          excel: {
            conductor: "CRISTIAN",
            recorrido: rec,
            n_factura: "5",
            total_factura: "1000000",
          },
        },
      },
    },
  };
}

function loadSheet(bytes) {
  const f = unzipSync(bytes);
  const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);
  const strs = [];
  for (const m of new TextDecoder()
    .decode(f["xl/sharedStrings.xml"])
    .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    strs.push(m[1].replace(/<[^>]+>/g, ""));
  }
  return { sheet, strs };
}

function cellVal(sheet, strs, ref) {
  const m = sheet.match(
    new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`)
  );
  if (!m) return null;
  if (m[0].endsWith("/>")) return "";
  const inner = m[2] ?? "";
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && /t="s"/.test(m[1])) return strs[+vm[1]] ?? "";
  const isT = inner.match(/<t[^>]*>([^<]*)<\/t>/);
  if (isT) return isT[1];
  const vn = inner.match(/<v>([^<]+)<\/v>/);
  return vn ? vn[1] : "";
}

function chequesAFechaRows(sheet, strs) {
  const rows = [];
  for (let r = 1; r <= 200; r++) {
    const m = cellVal(sheet, strs, `M${r}`);
    const n = cellVal(sheet, strs, `N${r}`);
    const o = cellVal(sheet, strs, `O${r}`);
    if (m && /^\d{2}-\d{2}-\d{4}$/.test(m) && n && o && /^\d+$/.test(o)) {
      rows.push({ r, m, n, o });
    }
  }
  return rows;
}

function soloORows(sheet) {
  let n = 0;
  for (const m of sheet.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells = [...m[2].matchAll(/<c r="([A-Z]+)\d+"/g)].map((x) => x[1]);
    if (cells.length === 1 && cells[0] === "O") n++;
  }
  return n;
}

const pedro = pedroRecord();
const ind = renderRendicionExcel(template, buildRendicionPayload(pedro));
const cons1 = buildConsolidatedWorkbook(template, [pedro]);
const consMulti = buildConsolidatedWorkbook(template, [
  heavyRecord("h1", "260006341", "127092"),
  heavyRecord("h2", "260006342", "972618", "ITAU"),
  pedro,
]);

const indS = loadSheet(ind);
const c1S = loadSheet(cons1);
const cmS = loadSheet(consMulti);

const indCheques = chequesAFechaRows(indS.sheet, indS.strs);
const c1Cheques = chequesAFechaRows(c1S.sheet, c1S.strs);
const cmCheques = chequesAFechaRows(cmS.sheet, cmS.strs);

const okSingleParity =
  indCheques.length === 2 &&
  c1Cheques.length === 2 &&
  indCheques[0].m === c1Cheques[0].m &&
  indCheques[0].n === c1Cheques[0].n &&
  indCheques[0].o === c1Cheques[0].o;

const okMulti =
  cmCheques.length >= 3 &&
  cmCheques.every((row) => row.m && row.n && row.o) &&
  soloORows(cmS.sheet) === 0 &&
  cmCheques.some((r) => r.o === "368449") &&
  cmCheques.some((r) => r.o === "92552");

const okUpper =
  cellVal(c1S.sheet, c1S.strs, "B1") === "PEDRO" &&
  cellVal(c1S.sheet, c1S.strs, "B12") === "461001";

console.log({
  okSingleParity,
  okMulti,
  okUpper,
  indCheques,
  c1Cheques,
  cmCheques: cmCheques.map((r) => `R${r.r}:${r.m}/${r.n}/${r.o}`),
  soloORows: soloORows(cmS.sheet),
});

if (!okSingleParity || !okMulti || !okUpper) process.exit(1);
console.log("PASS consolidated cheques a fecha");
