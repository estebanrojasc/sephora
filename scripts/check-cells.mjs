import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const f = unzipSync(readFileSync("scripts/.tmp/test-full.xlsx"));
const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);
const strs = [];
for (const m of new TextDecoder()
  .decode(f["xl/sharedStrings.xml"])
  .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g))
  strs.push(m[1].replace(/<[^>]+>/g, ""));

function getCell(ref) {
  const re = new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`);
  const m = sheet.match(re);
  if (!m) return "(missing)";
  const attrs = m[1] ?? "";
  const inner = m[2] ?? "";
  if (m[0].endsWith("/>")) return "(empty)";
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && attrs.includes('t="s"')) return strs[parseInt(vm[1], 10)] ?? "";
  const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
  if (isT) return isT[1];
  const vn = inner.match(/<v>([^<]+)<\/v>/);
  return vn ? vn[1] : "(empty)";
}

console.log("=== CHEQUES (R36-R45) ===");
for (let r = 36; r <= 45; r++)
  console.log(`R${r}: M=${getCell("M" + r)} N=${getCell("N" + r)} O=${getCell("O" + r)}`);

console.log("\n=== CREDITO/TRANSF (R70-R78) ===");
for (let r = 70; r <= 78; r++)
  console.log(
    `R${r}: L=${getCell("L" + r)} M=${getCell("M" + r)} R=${getCell("R" + r)} T=${getCell("T" + r)} V=${getCell("V" + r)}`
  );

console.log("\n=== ESCALARES CLAVE ===");
for (const [ref, label] of [
  ["N23", "Fecha"],
  ["B1", "Conductor"],
  ["B2", "Auxiliar"],
  ["B5", "Recorrido"],
  ["B6", "N factura"],
  ["B7", "Total factura"],
  ["B11", "Total chq al día"],
  ["B12", "Total chq a fecha"],
  ["B13", "Total crédito"],
  ["B14", "Total retorno total"],
  ["B15", "Total retorno parcial"],
  ["B16", "Total NC negocio"],
  ["B17", "Total transferencia"],
  ["Q27", "Resumen billetes"],
  ["Q28", "Resumen chq al día"],
  ["Q29", "Resumen crédito"],
  ["Q34", "Total rendición"],
  ["U23", "Cant facturas"],
  ["U24", "Valor total"],
  ["Q65", "NC rechazo total"],
  ["S65", "NC rechazo parcial"],
  ["U65", "NC por negocios"],
])
  console.log(`  ${ref} (${label}): ${getCell(ref)}`);
