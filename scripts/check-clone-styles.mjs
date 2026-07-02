/**
 * Verifica estilos en filas clonadas del test-full.xlsx generado.
 * Compara estilos de filas ancla, spare y clonadas.
 */
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const tpl = unzipSync(readFileSync("templates/RUTA CFT-ABL -2026.xlsx"));
const gen = unzipSync(readFileSync("scripts/.tmp/test-full.xlsx"));

const sheet = new TextDecoder().decode(tpl["xl/worksheets/sheet1.xml"]);
const genSheet = new TextDecoder().decode(gen["xl/worksheets/sheet1.xml"]);

function getCellStyle(xml, ref) {
  const re = new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>[\\s\\S]*?<\\/c>)`);
  const m = xml.match(re);
  if (!m) return null;
  const sMatch = m[1].match(/\bs="(\d+)"/);
  return sMatch ? parseInt(sMatch[1]) : 0;
}

function getCellValue(xml, ref, strings) {
  const re = new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`);
  const m = xml.match(re);
  if (!m) return null;
  const attrs = m[1] ?? "";
  const inner = m[2] ?? "";
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && attrs.includes('t="s"') && strings) return strings[parseInt(vm[1])] ?? "";
  const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
  if (isT) return isT[1];
  const vn = inner.match(/<v>([^<]+)<\/v>/);
  return vn ? vn[1] : "(empty)";
}

function getRowTag(xml, rowNum) {
  const re = new RegExp(`<row\\b[^>]*\\br="${rowNum}"[^>]*>`);
  return xml.match(re)?.[0] ?? "(not found)";
}

const strs = [];
for (const m of new TextDecoder()
  .decode(gen["xl/sharedStrings.xml"] || new Uint8Array())
  .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g))
  strs.push(m[1].replace(/<[^>]+>/g, ""));

console.log("=== VERIFICACIÓN DE ESTILOS EN FILAS CLONADAS ===\n");

// ── cheques_rech: anchor=37, cloneStyleRow=40, cloned row en test=38 ──
// (Test tiene 2 cheques al dia → se inserta fila 38 clonada)
console.log("1) cheques_rech (anchor=37, cloneStyle=40, clonada=38 en output)");
const chqCols = ["M","N","O","P","Q","R","S","T","U"];
let allOk = true;
for (const col of chqCols) {
  const sAncla  = getCellStyle(sheet, `${col}37`);  // ancla template
  const sSpare  = getCellStyle(sheet, `${col}40`);  // spare template (referencia)
  const sClone  = getCellStyle(genSheet, `${col}38`); // fila clonada en output
  const match = sClone === sSpare
    ? "✓"
    : sClone === sAncla
    ? "⚠ usa estilo ANCLA (debería ser SPARE)"
    : `✗ s${sClone} (ancla=s${sAncla} spare=s${sSpare})`;
  if (sAncla !== sSpare) {
    // Solo mostrar columnas donde el estilo spare difiere del ancla (relevantes)
    console.log(`   col ${col}: ancla=s${sAncla} spare=s${sSpare} clonada=s${sClone} ${match}`);
    if (sClone !== sSpare) allOk = false;
  }
}
if (allOk) console.log("   Todas las columnas con diferencias usan el estilo correcto (spare) ✓");

// ── cheques_a_fecha: con templateDataRows=12, debe llenar spare rows sin insertar ──
console.log("\n2) cheques_a_fecha (templateDataRows=12, NO clona sino rellena spare rows)");
// Test: 1 cheque a fecha → va a R40 (spare row 40) directamente
console.log(`   Template R40: M=s${getCellStyle(sheet,"M40")} N=s${getCellStyle(sheet,"N40")} O=s${getCellStyle(sheet,"O40")}`);
console.log(`   Output   R40: M=s${getCellStyle(genSheet,"M40")} N=s${getCellStyle(genSheet,"N40")} O=s${getCellStyle(genSheet,"O40")}`);
console.log(`   Valor  R40  : M=${getCellValue(genSheet,"M40",strs)} N=${getCellValue(genSheet,"N40",strs)} O=${getCellValue(genSheet,"O40",strs)}`);

// ── credito: anchor=72 (shifted), cloned=73, sin cloneStyleRow → usa ancla ──
console.log("\n3) credito (anchor=72, cloned=73, sin cloneStyleRow)");
const credCols = ["L","M","O","P","R","T","U","V"];
let credAllOk = true;
for (const col of credCols) {
  const sAncla = getCellStyle(genSheet, `${col}72`);
  const sClone = getCellStyle(genSheet, `${col}73`);
  if (sAncla !== sClone) {
    console.log(`   col ${col}: ancla(72)=s${sAncla} clonada(73)=s${sClone} ⚠ diferentes`);
    credAllOk = false;
  }
}
if (credAllOk) console.log("   Todos los estilos ancla=clonada ✓");
console.log(`   Valores: L72=${getCellValue(genSheet,"L72",strs)} M72=${getCellValue(genSheet,"M72",strs)}`);
console.log(`            L73=${getCellValue(genSheet,"L73",strs)} M73=${getCellValue(genSheet,"M73",strs)}`);

// ── Row tags: verificar no thickBot, no dyDescent duplicado ──
console.log("\n4) Row tags de filas clonadas (no deben tener thickBot ni dyDescent duplicado)");
for (const r of [38, 73, 75]) {
  const tag = getRowTag(genSheet, r);
  const issues = [];
  if ((tag.match(/thickBot/g) || []).length > 0) issues.push("thickBot PRESENTE");
  if ((tag.match(/thickTop/g) || []).length > 0) issues.push("thickTop PRESENTE");
  if ((tag.match(/x14ac:dyDescent/g) || []).length > 1) issues.push("DUPLICADO dyDescent");
  if ((tag.match(/customHeight/g) || []).length > 0) issues.push("customHeight PRESENTE");
  console.log(`   R${r}: ${issues.length ? issues.join(", ") : "✓ limpio"}`);
}
