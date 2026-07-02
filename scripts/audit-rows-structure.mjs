/**
 * Audita la estructura de filas de la plantilla para cada bloque de lista.
 * Muestra: cuántas filas "spare" (vacías con estilo) hay en cada sección,
 * y los estilos reales de las celdas clave.
 */
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const tpl = unzipSync(readFileSync("templates/RUTA CFT-ABL -2026.xlsx"));
const sheet = new TextDecoder().decode(tpl["xl/worksheets/sheet1.xml"]);
const strs = [];
for (const m of new TextDecoder()
  .decode(tpl["xl/sharedStrings.xml"])
  .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g))
  strs.push(m[1].replace(/<[^>]+>/g, ""));

function getRowXml(xml, rowNum) {
  const re = new RegExp(`<row\\b[^>]*\\br="${rowNum}"[^>]*>[\\s\\S]*?<\\/row>`);
  return xml.match(re)?.[0] ?? null;
}

function getCellInfo(xml, ref) {
  const re = new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`);
  const m = xml.match(re);
  if (!m) return null;
  const attrs = m[1] ?? "";
  const inner = m[2] ?? "";
  const sMatch = attrs.match(/\bs="(\d+)"/);
  const style = sMatch ? parseInt(sMatch[1]) : 0;
  const vm = inner.match(/<v>(\d+)<\/v>/);
  let val = "";
  if (vm && attrs.includes('t="s"')) val = strs[parseInt(vm[1], 10)] ?? "";
  const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
  if (isT) val = isT[1];
  const vn = inner.match(/<v>([^<]+)<\/v>/);
  if (!val && vn) val = vn[1];
  const hasFormula = inner.includes("<f");
  return { style, val, hasFormula, exists: true };
}

function rowExists(xml, rowNum) {
  return new RegExp(`<row\\b[^>]*\\br="${rowNum}"`).test(xml);
}

function inspectSection(label, startRow, endRow, keyCols) {
  console.log(`\n=== ${label} (rows ${startRow}-${endRow}) ===`);
  for (let r = startRow; r <= endRow; r++) {
    if (!rowExists(sheet, r)) {
      console.log(`  R${r}: NO EXISTE en XML`);
      continue;
    }
    const rowXml = getRowXml(sheet, r);
    const rowAttrsMatch = rowXml?.match(/<row\b([^>]*)>/);
    const rowAttrs = rowAttrsMatch?.[1] ?? "";
    const parts = [];
    for (const col of keyCols) {
      const info = getCellInfo(sheet, `${col}${r}`);
      if (!info) parts.push(`${col}=missing`);
      else {
        const v = info.val ? `"${info.val}"` : "(empty)";
        parts.push(`${col}=s${info.style} ${v}${info.hasFormula ? " [FORMULA]" : ""}`);
      }
    }
    const thickFlags = [];
    if (rowAttrs.includes("thickBot")) thickFlags.push("THICKBOT");
    if (rowAttrs.includes("thickTop")) thickFlags.push("THICKTOP");
    if (rowAttrs.includes("customHeight")) thickFlags.push("customH");
    console.log(`  R${r}: ${parts.join(" | ")} ${thickFlags.length ? "[" + thickFlags.join(",") + "]" : ""}`);
  }
}

// Bloque 1: cheques_rech (ancla=37, cloneStyleRow=40)
inspectSection("CHEQUES_RECH / CHQ AL DIA", 36, 50, ["M", "N", "O", "P", "Q", "R", "S", "T", "U"]);

// Bloque 2: cheques_a_fecha (ancla=39, cloneStyleRow=40)
// (ya cubierto arriba, pero veamos hasta donde llegan las filas vacías)

// Bloque credito (ancla=71, cloneStyleRow=72)
inspectSection("CREDITO", 68, 80, ["L", "M", "O", "P", "R", "T", "U", "V"]);

// Bloque transferencia (ancla=73, cloneStyleRow=75)
inspectSection("TRANSFERENCIA", 73, 82, ["L", "M", "O", "P", "R", "T", "U", "V"]);

// Resumen de filas disponibles por bloque
console.log("\n=== RESUMEN DE SPARE ROWS ===");
// cheques_a_fecha: rows 39-?
let chqFechaSpare = 0;
for (let r = 39; r <= 70; r++) {
  if (!rowExists(sheet, r)) break;
  const m = getCellInfo(sheet, `M${r}`);
  if (!m) break;
  if (m.val && m.val.includes("{{")) { 
    chqFechaSpare++;
    continue; // placeholder row = first data row 
  }
  if (!m.val) { chqFechaSpare++; continue; } // empty = spare
  break; // non-placeholder, non-empty = end of section
}
console.log(`  cheques_a_fecha: ${chqFechaSpare} fila(s) de datos disponibles (desde R39)`);

let credSpare = 0;
for (let r = 71; r <= 90; r++) {
  if (!rowExists(sheet, r)) break;
  const m = getCellInfo(sheet, `M${r}`);
  if (!m?.val) { credSpare++; continue; }
  if (m.val.includes("{{")) { credSpare++; continue; }
  if (m.val === "F/.") { credSpare++; continue; }
  break;
}
console.log(`  credito: ${credSpare} fila(s) de datos disponibles (desde R71)`);

let transfSpare = 0;
for (let r = 73; r <= 90; r++) {
  if (!rowExists(sheet, r)) break;
  const m = getCellInfo(sheet, `M${r}`);
  if (!m?.val) { transfSpare++; continue; }
  if (m.val.includes("{{")) { transfSpare++; continue; }
  if (m.val === "F/.") { transfSpare++; continue; }
  break;
}
console.log(`  transferencia: ${transfSpare} fila(s) de datos disponibles (desde R73)`);
