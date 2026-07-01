import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../../src/features/records/types.ts";
import { buildRendicionPayload } from "../../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");
const e = createEmptyExtraction();
e.n_recorrido.valor = "260006344";
e.detalle_credito_vendedor = [
  { cliente: { valor: "Dist. MENE Spa", bbox: [0, 0, 0, 0] }, no_fac: { valor: "605832", bbox: [0, 0, 0, 0] }, valor: { valor: "1441918", bbox: [0, 0, 0, 0] }, nro_vendedor: { valor: "69", bbox: [0, 0, 0, 0] } },
  { cliente: { valor: "Carlos Abarca", bbox: [0, 0, 0, 0] }, no_fac: { valor: "605790", bbox: [0, 0, 0, 0] }, valor: { valor: "639578", bbox: [0, 0, 0, 0] }, nro_vendedor: { valor: "70", bbox: [0, 0, 0, 0] } },
  { cliente: { valor: "HERMES LOPEZ", bbox: [0, 0, 0, 0] }, no_fac: { valor: "605741", bbox: [0, 0, 0, 0] }, valor: { valor: "1209230", bbox: [0, 0, 0, 0] }, nro_vendedor: { valor: "79", bbox: [0, 0, 0, 0] } },
  { cliente: { valor: "CO JUANTIA", bbox: [0, 0, 0, 0] }, no_fac: { valor: "605755", bbox: [0, 0, 0, 0] }, valor: { valor: "1237147", bbox: [0, 0, 0, 0] }, nro_vendedor: { valor: "79", bbox: [0, 0, 0, 0] } },
];
e.detalle_transferencias = [
  { cliente: { valor: "Minirosket natalia", bbox: [0, 0, 0, 0] }, no_fac: { valor: "605731", bbox: [0, 0, 0, 0] }, valor: { valor: "42098", bbox: [0, 0, 0, 0] }, banco: { valor: "Banco Estado", bbox: [0, 0, 0, 0] } },
];
const out = renderRendicionExcel(template, buildRendicionPayload({ id: "x", status: "saved", createdAt: "", updatedAt: "", images: [], extraction: e }));
const sheet = new TextDecoder().decode(unzipSync(out)["xl/worksheets/sheet1.xml"]);
function g(ref) {
  const m = sheet.match(new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`));
  if (!m) return "";
  const inner = m[2] ?? "";
  return inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/)?.[1] ?? inner.match(/<v>([^<]*)<\/v>/)?.[1] ?? "";
}
for (let r = 71; r <= 78; r++) {
  console.log(`R${r}: M=${g(`M${r}`)||"-"} P=${g(`P${r}`)||"-"} L=${g(`L${r}`)||"-"} T=${g(`T${r}`)||"-"}`);
}
