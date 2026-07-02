/**
 * Simula el bug histórico: cheques_a_fecha con templateDataRows=1
 * insertaba filas clonadas rotas (solo columna O).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { buildRendicionPayload, mergeRendicionPayloads } from "../../src/features/excel/build-rendicion.ts";

// Patch render by importing and testing expand logic via eval - simpler: read render.ts and test manually
import { renderConsolidatedResumenWorksheet } from "../../src/features/excel/render.ts";
import { buildConsolidatedWorkbook } from "../../src/features/excel/build-consolidated.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function heavyRecord(id, rec, chqValor) {
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
        cheques_a_fecha: { valor: chqValor, bbox: [0,0,0,0] },
        credito_vendedor: { valor: "", bbox: [0,0,0,0] },
        retorno_total: { valor: "", bbox: [0,0,0,0] },
        retorno_parcial: { valor: "", bbox: [0,0,0,0] },
        n_c_negocio: { valor: "", bbox: [0,0,0,0] },
        transferencia: { valor: "", bbox: [0,0,0,0] },
        total: { valor: "1000000", bbox: [0,0,0,0] },
      },
      detalles_cheques: [
        { fecha: { valor: "30-07-2026", bbox: [0,0,0,0] }, banco: { valor: "SANTANDER", bbox: [0,0,0,0] }, valor: { valor: chqValor, bbox: [0,0,0,0] } },
      ],
      n_c_rechazo_total: Array.from({ length: 17 }, (_, i) => ({
        no_fac: { valor: String(605655 + i), bbox: [0,0,0,0] },
        valor: { valor: String(10000 + i), bbox: [0,0,0,0] },
      })),
      n_c_rechazo_parcial: [], n_c_por_negocios: [],
      detalle_transferencias: [], detalle_credito_vendedor: [],
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
  heavyRecord("h1", "260006341", "127092"),
  heavyRecord("h2", "260006342", "972618"),
  heavyRecord("h3", "260006343", "368449"),
  heavyRecord("h4", "260006344", "92552"),
];

const payloads = records.map((r) => buildRendicionPayload(r));
const merged = mergeRendicionPayloads(payloads);
console.log("merged cheques_a_fecha:", merged.lists.cheques_a_fecha.length);
console.log("merged rech_total:", merged.lists.rech_total.length);
console.log("sample:", merged.lists.cheques_a_fecha[0]);

const out = buildConsolidatedWorkbook(template, records);
writeFileSync("scripts/.tmp/cons-4heavy.xlsx", out);

const s = new TextDecoder().decode(unzipSync(out)["xl/worksheets/sheet1.xml"]);
let soloO = 0;
for (const m of s.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const cells = [...m[2].matchAll(/<c r="([A-Z]+)\d+"/g)].map((x) => x[1]);
  if (cells.length === 1 && cells[0] === "O") soloO++;
}
console.log("filas con SOLO O:", soloO);

const strs = [];
for (const m of new TextDecoder().decode(unzipSync(out)["xl/sharedStrings.xml"]).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g))
  strs.push(m[1].replace(/<[^>]+>/g, ""));

function cv(ref) {
  const m = s.match(new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`));
  if (!m) return "?";
  if (m[0].endsWith("/>")) return "";
  const inner = m[2] ?? "";
  const isT = inner.match(/<t[^>]*>([^<]*)<\/t>/);
  if (isT) return isT[1];
  const vn = inner.match(/<v>([^<]+)<\/v>/);
  return vn ? vn[1] : "";
}

for (let r = 50; r <= 100; r++) {
  const m = cv(`M${r}`), n = cv(`N${r}`), o = cv(`O${r}`);
  if (m || n || (o && !["0"].includes(o)))
    if (/^\d+$/.test(o) || m.includes("-") || n.length > 1)
      console.log(`R${r}: M=${m} N=${n} O=${o}`);
}
