/**
 * Test integral: genera Excel con datos reales y verifica que TODOS los
 * placeholders de la plantilla queden reemplazados con valores.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../src/features/records/types.ts";
import { buildRendicionPayload } from "../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

// Datos de prueba con todos los campos posibles
const e = createEmptyExtraction();
e.fecha = { valor: "30/06/2026", bbox: [0, 0, 0, 0] };
e.n_recorrido = { valor: "260006344", bbox: [0, 0, 0, 0] };
e.conductor = { valor: "JUAN PEREZ", bbox: [0, 0, 0, 0] };
e.auxiliar = { valor: "PEDRO GONZALEZ", bbox: [0, 0, 0, 0] };
e.patente = { valor: "ABC-123", bbox: [0, 0, 0, 0] };
e.cant_fact = { valor: "12", bbox: [0, 0, 0, 0] };
e.valor_total = { valor: "1250000", bbox: [0, 0, 0, 0] };
e.rendicion = {
  ...e.rendicion,
  cheques_al_dia: { valor: "350000", bbox: [0, 0, 0, 0] },
  cheques_a_fecha: { valor: "200000", bbox: [0, 0, 0, 0] },
  credito_vendedor: { valor: "500000", bbox: [0, 0, 0, 0] },
  transferencia: { valor: "100000", bbox: [0, 0, 0, 0] },
  retorno_total: { valor: "50000", bbox: [0, 0, 0, 0] },
  retorno_parcial: { valor: "25000", bbox: [0, 0, 0, 0] },
  n_c_negocio: { valor: "15000", bbox: [0, 0, 0, 0] },
  total: { valor: "1190000", bbox: [0, 0, 0, 0] },
};
e.total_n_c_rechazo_total = { valor: "5", bbox: [0, 0, 0, 0] };
e.total_n_c_rechazo_parcial = { valor: "3", bbox: [0, 0, 0, 0] };
e.total_n_c_por_negocios = { valor: "2", bbox: [0, 0, 0, 0] };
e.detalles_cheques = [
  {
    fecha: { valor: "28/06/2026", bbox: [0, 0, 0, 0] },
    banco: { valor: "BCI", bbox: [0, 0, 0, 0] },
    valor: { valor: "150000", bbox: [0, 0, 0, 0] },
  },
  {
    fecha: { valor: "29/06/2026", bbox: [0, 0, 0, 0] },
    banco: { valor: "SANTANDER", bbox: [0, 0, 0, 0] },
    valor: { valor: "200000", bbox: [0, 0, 0, 0] },
  },
  // uno a fecha (futuro)
  {
    fecha: { valor: "15/07/2026", bbox: [0, 0, 0, 0] },
    banco: { valor: "BANCO ESTADO", bbox: [0, 0, 0, 0] },
    valor: { valor: "200000", bbox: [0, 0, 0, 0] },
  },
];
e.detalle_credito_vendedor = [
  {
    cliente: { valor: "CLIENTE A", bbox: [0, 0, 0, 0] },
    no_fac: { valor: "1234", bbox: [0, 0, 0, 0] },
    valor: { valor: "250000", bbox: [0, 0, 0, 0] },
    nro_vendedor: { valor: "69", bbox: [0, 0, 0, 0] },
  },
  {
    cliente: { valor: "CLIENTE B", bbox: [0, 0, 0, 0] },
    no_fac: { valor: "1235", bbox: [0, 0, 0, 0] },
    valor: { valor: "250000", bbox: [0, 0, 0, 0] },
    nro_vendedor: { valor: "70", bbox: [0, 0, 0, 0] },
  },
];
e.detalle_transferencias = [
  {
    cliente: { valor: "EMPRESA X", bbox: [0, 0, 0, 0] },
    no_fac: { valor: "9901", bbox: [0, 0, 0, 0] },
    valor: { valor: "100000", bbox: [0, 0, 0, 0] },
    banco: { valor: "ITAU", bbox: [0, 0, 0, 0] },
  },
];

const record = {
  id: "test-full",
  status: "saved",
  createdAt: "2026-06-30",
  updatedAt: "2026-06-30",
  images: [],
  extraction: e,
};

const payload = buildRendicionPayload(record);
console.log("=== PAYLOAD SCALARS ===");
for (const [k, v] of Object.entries(payload.scalars)) {
  if (v.value) console.log(` ${k} = "${v.value}"`);
  else console.log(` ${k} = [vacío]`);
}
console.log("=== LISTAS ===");
for (const [k, v] of Object.entries(payload.lists)) {
  console.log(` ${k}: ${Array.isArray(v) ? v.length : 0} ítems`);
}

const out = renderRendicionExcel(template, payload);
writeFileSync("scripts/.tmp/test-full.xlsx", out);
console.log(`\nArchivo generado: scripts/.tmp/test-full.xlsx (${out.byteLength} bytes)`);

// Verificar placeholders
const files = unzipSync(out);
const sheet = new TextDecoder().decode(files["xl/worksheets/sheet1.xml"]);
const strs = [];
for (const m of new TextDecoder()
  .decode(files["xl/sharedStrings.xml"])
  .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
  strs.push(m[1].replace(/<[^>]+>/g, ""));
}

const leftovers = [];
const allCells = [];
for (const m of sheet.matchAll(/<c r="([^"]+)"([^>]*)>([^<]*(?:<(?!\/c)[^<]*)*)<\/c>/g)) {
  const ref = m[1];
  const attrs = m[2];
  const inner = m[3] ?? "";
  const vm = inner.match(/<v>(\d+)<\/v>/);
  let val = "";
  if (vm && attrs.includes('t="s"')) val = strs[parseInt(vm[1], 10)] ?? "";
  const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
  if (isT) val = isT[1];
  const vn = inner.match(/<v>([^<]+)<\/v>/);
  if (!val && vn && !attrs.includes('t="s"')) val = vn[1];
  if (val.includes("{{")) leftovers.push(`  ${ref} = "${val}"`);
  if (val && !val.includes("{{") && !inner.includes("<f")) allCells.push(`${ref}=${val}`);
}

console.log("\n=== PLACEHOLDERS SIN REEMPLAZAR ===");
if (leftovers.length === 0) {
  console.log("  NINGUNO - todos los placeholders fueron reemplazados ✓");
} else {
  console.log(`  ${leftovers.length} placeholders sin reemplazar:`);
  leftovers.forEach((l) => console.log(l));
}

// Verificar celdas clave
function getCell(ref) {
  for (const line of allCells) {
    if (line.startsWith(ref + "=")) return line.slice(ref.length + 1);
  }
  return "(vacío)";
}

console.log("\n=== CELDAS CLAVE ===");
const keyCells = [
  ["M37", "Cheque al día fecha 1"],
  ["N37", "Cheque al día banco 1"],
  ["O37", "Cheque al día valor 1"],
  ["M38", "Cheque al día fecha 2"],
  ["O38", "Total cheques al día - o cheque 2"],
  ["M39", "Cheque a fecha fecha 1 (o fila shifted)"],
  ["N39", "Cheque a fecha banco 1"],
  ["O39", "Cheque a fecha valor 1"],
  ["L71", "Crédito recorrido"],
  ["M71", "Crédito cliente"],
  ["T71", "Crédito valor"],
  ["V71", "Crédito vendedor"],
  ["L72", "Crédito recorrido 2"],
  ["M72", "Crédito cliente 2"],
  ["L73", "Transf recorrido"],
  ["M73", "Transf cliente"],
  ["T73", "Transf valor"],
  ["U73", "Transf banco"],
  ["N23", "Fecha"],
  ["B11", "Total cheques al día"],
  ["B12", "Total cheques a fecha"],
  ["B13", "Total crédito vendedor"],
];
for (const [ref, label] of keyCells) {
  console.log(`  ${ref} (${label}): ${getCell(ref)}`);
}
