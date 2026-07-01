/**
 * Verifica que no queden {{placeholders}} sin reemplazar tras renderizar.
 * Uso: npx tsx scripts/test-excel-placeholders.mjs
 */
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../src/features/records/types.ts";
import { buildRendicionPayload } from "../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function scanPlaceholders(bytes) {
  const f = unzipSync(bytes);
  const strings = [];
  for (const m of new TextDecoder()
    .decode(f["xl/sharedStrings.xml"])
    .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    strings.push(m[1].replace(/<[^>]+>/g, ""));
  }
  const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);
  const leftover = [];
  for (const m of sheet.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
    const inner = m[4];
    const vm = inner.match(/<v>(\d+)<\/v>/);
    let val = "";
    if (vm && m[3].includes('t="s"')) val = strings[parseInt(vm[1], 10)] ?? "";
    const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
    if (isT) val = isT[1];
    if (val.includes("{{")) leftover.push(`${m[1]}${m[2]}: ${val}`);
  }
  return leftover;
}

const e = createEmptyExtraction();
e.fecha.valor = "30/06/2026";
e.conductor.valor = "Juan Pérez";
e.n_recorrido.valor = "260006344";
e.cant_fact.valor = "12";
e.valor_total.valor = "1500000";
e.rendicion.cheques_al_dia.valor = "200000";
e.rendicion.cheques_a_fecha.valor = "100000";
e.rendicion.credito_vendedor.valor = "500000";
e.rendicion.transferencia.valor = "80000";
e.rendicion.retorno_total.valor = "5000";
e.rendicion.retorno_parcial.valor = "3000";
e.rendicion.n_c_negocio.valor = "2000";
e.rendicion.total.valor = "1500000";
e.total_n_c_rechazo_total.valor = "5000";
e.total_n_c_rechazo_parcial.valor = "3000";
e.total_n_c_por_negocios.valor = "2000";
e.detalle_efectivo.total_billetes.valor = "180000";
e.detalle_efectivo.total_monedas.valor = "20000";
e.detalles_cheques = [
  { fecha: { valor: "30/06/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "BCI", bbox: [0, 0, 0, 0] }, valor: { valor: "100000", bbox: [0, 0, 0, 0] } },
  { fecha: { valor: "15/07/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "SANT", bbox: [0, 0, 0, 0] }, valor: { valor: "100000", bbox: [0, 0, 0, 0] } },
];
e.n_c_rechazo_total = [{ no_fac: { valor: "101", bbox: [0, 0, 0, 0] }, valor: { valor: "5000", bbox: [0, 0, 0, 0] } }];
e.n_c_rechazo_parcial = [{ no_fac: { valor: "102", bbox: [0, 0, 0, 0] }, valor: { valor: "3000", bbox: [0, 0, 0, 0] } }];
e.n_c_por_negocios = [{ no_fac: { valor: "103", bbox: [0, 0, 0, 0] }, valor: { valor: "2000", bbox: [0, 0, 0, 0] } }];
e.detalle_credito_vendedor = [{ cliente: { valor: "Cliente SA", bbox: [0, 0, 0, 0] }, no_fac: { valor: "605832", bbox: [0, 0, 0, 0] }, valor: { valor: "500000", bbox: [0, 0, 0, 0] }, nro_vendedor: { valor: "69", bbox: [0, 0, 0, 0] } }];
e.detalle_transferencias = [{ cliente: { valor: "Transf SA", bbox: [0, 0, 0, 0] }, no_fac: { valor: "605731", bbox: [0, 0, 0, 0] }, valor: { valor: "80000", bbox: [0, 0, 0, 0] }, banco: { valor: "Estado", bbox: [0, 0, 0, 0] } }];
e._meta = {
  bitacora: {
    bitacoraId: "b1",
    rowId: "r1",
    version: 1,
    matchScore: 80,
    suggested: {},
    excel: {
      conductor: "Juan Pérez",
      auxiliar: "Aux",
      recorrido: "260006344",
      n_factura: "12",
      total_factura: "1500000",
    },
  },
  confidence: 1,
  processedImageIds: [],
  processedAt: new Date().toISOString(),
};

const payload = buildRendicionPayload({
  id: "full",
  status: "saved",
  createdAt: "",
  updatedAt: "",
  images: [],
  extraction: e,
});

const out = renderRendicionExcel(template, payload);
const leftover = scanPlaceholders(out);

if (leftover.length === 0) {
  console.log("PASS: ningún {{}} sin reemplazar en la hoja");
} else {
  console.log("FAIL: placeholders restantes:");
  for (const line of leftover) console.log(" ", line);
  process.exit(1);
}
