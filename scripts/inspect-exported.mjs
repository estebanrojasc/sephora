/**
 * Inspecciona el archivo exportado por el usuario para diagnosticar:
 * 1. "Registros quitados: Información de celda"
 * 2. Contenido repetido hacia abajo
 * 3. cheque a fecha: solo aparece el valor
 */
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const path = process.argv[2] ?? "RUTA CFT-ABL 30-06-2026 (15).xlsx";
const f = unzipSync(readFileSync(path));
const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);
const strs = [];
for (const m of new TextDecoder()
  .decode(f["xl/sharedStrings.xml"] ?? new Uint8Array())
  .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g))
  strs.push(m[1].replace(/<[^>]+>/g, ""));

function getCellInfo(xml, ref) {
  const re = new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`);
  const m = xml.match(re);
  if (!m) return null;
  const attrs = m[1] ?? "";
  const inner = m[2] ?? "";
  const sMatch = attrs.match(/\bs="(\d+)"/);
  const style = sMatch ? parseInt(sMatch[1]) : 0;
  const tMatch = attrs.match(/\bt="([^"]+)"/);
  const type = tMatch?.[1] ?? "numeric";
  const vm = inner.match(/<v>(\d+)<\/v>/);
  let val = "";
  if (vm && type === "s") val = strs[parseInt(vm[1], 10)] ?? `[ss:${vm[1]}]`;
  const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
  if (isT) val = isT[1];
  const vn = inner.match(/<v>([^<]+)<\/v>/);
  if (!val && vn) val = vn[1];
  const hasFormula = /<f/.test(inner);
  return { style, type, val, hasFormula };
}

function rowExists(xml, n) {
  return new RegExp(`<row\\b[^>]*\\br="${n}"`).test(xml);
}

function getRowTag(xml, n) {
  const re = new RegExp(`<row\\b[^>]*\\br="${n}"[^>]*>`);
  return xml.match(re)?.[0] ?? "(not found)";
}

// ── Buscar la sección de cheques_a_fecha ─────────────────────────────────────
// La plantilla tiene el placeholder en M39 (puede estar desplazado)
console.log("=== SECCIÓN CHEQUES (rows 36-60) ===");
for (let r = 36; r <= 60; r++) {
  if (!rowExists(sheet, r)) continue;
  const m = getCellInfo(sheet, `M${r}`);
  const n = getCellInfo(sheet, `N${r}`);
  const o = getCellInfo(sheet, `O${r}`);
  if (!m && !n && !o) continue;
  const show = (c) => !c ? "missing" : c.val ? `"${c.val}"(s${c.style})${c.hasFormula?"[F]":""}` : `(empty s${c.style})`;
  console.log(`  R${r}: M=${show(m)} N=${show(n)} O=${show(o)}`);
}

// ── Sección crédito/transferencia ─────────────────────────────────────────────
console.log("\n=== SECCIÓN CREDITO/TRANSF (rows 65-95) ===");
for (let r = 65; r <= 95; r++) {
  if (!rowExists(sheet, r)) continue;
  const l = getCellInfo(sheet, `L${r}`);
  const m = getCellInfo(sheet, `M${r}`);
  const rC = getCellInfo(sheet, `R${r}`);
  const t = getCellInfo(sheet, `T${r}`);
  const v = getCellInfo(sheet, `V${r}`);
  const show = (c) => !c ? "–" : c.val ? `"${c.val}"(s${c.style})${c.hasFormula?"[F]":""}` : `(empty s${c.style})`;
  if (!l && !m && !rC && !t && !v) continue;
  console.log(`  R${r}: L=${show(l)} M=${show(m)} R=${show(rC)} T=${show(t)} V=${show(v)}`);
}

// ── Verificar celdas problemáticas (inlineStr donde debería ser otro tipo) ───
console.log("\n=== CELDAS inlineStr SOSPECHOSAS (t=inlineStr con valor numérico) ===");
let inlineStrCount = 0;
for (const m of sheet.matchAll(/<c r="([^"]+)"([^>]*) t="inlineStr"[^>]*>([\s\S]*?)<\/c>/g)) {
  const ref = m[1];
  const inner = m[3];
  const textMatch = inner.match(/<t[^>]*>([^<]*)<\/t>/);
  const text = textMatch?.[1] ?? "";
  if (/^\d+\.?\d*$/.test(text)) {
    console.log(`  ${ref}: "${text}" (numérico como inlineStr - posible error)`);
    inlineStrCount++;
  }
}
if (inlineStrCount === 0) console.log("  Ninguna detectada ✓");

// ── Verificar shared string refs inválidos ───────────────────────────────────
console.log("\n=== REFS A SHARED STRINGS INVÁLIDOS ===");
let badRefCount = 0;
for (const m of sheet.matchAll(/<c r="([^"]+)"([^>]*) t="s"[^>]*>[\s\S]*?<v>(\d+)<\/v>/g)) {
  const ref = m[1];
  const idx = parseInt(m[3]);
  if (idx >= strs.length) {
    console.log(`  ${ref}: shared string index ${idx} fuera de rango (max: ${strs.length - 1})`);
    badRefCount++;
  }
}
if (badRefCount === 0) console.log("  Ninguno ✓");

// ── Contar filas por rango ───────────────────────────────────────────────────
console.log("\n=== CONTEO DE FILAS EN RANGOS CLAVE ===");
let total = 0;
for (const m of sheet.matchAll(/<row\b[^>]*\br="(\d+)"/g)) total++;
const lastRowMatch = sheet.match(/r="(\d+)"[^>]*\/?>(?!<\/)/g);
let maxRow = 0;
for (const m of sheet.matchAll(/\br="(\d+)"\b/g)) {
  const n = parseInt(m[1]);
  if (n < 10000 && n > maxRow) maxRow = n;
}
console.log(`  Total filas en XML: ~${total}`);
console.log(`  Fila máxima: ${maxRow}`);

// ── Celdas con tipo "inlineStr" total ─────────────────────────────────────────
const inlineCount = (sheet.match(/t="inlineStr"/g) || []).length;
const sharedCount = (sheet.match(/t="s"/g) || []).length;
const formulaCount = (sheet.match(/<f\b/g) || []).length;
console.log(`  Celdas inlineStr: ${inlineCount} | shared: ${sharedCount} | formulas: ${formulaCount}`);
