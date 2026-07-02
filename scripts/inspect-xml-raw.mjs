/**
 * Muestra el XML crudo de filas clave en el archivo exportado.
 */
import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const path = process.argv[2] ?? "RUTA CFT-ABL 30-06-2026 (15).xlsx";
const f = unzipSync(readFileSync(path));
const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);

function getRowXml(xml, rowNum) {
  const re = new RegExp(`<row\\b[^>]*\\br="${rowNum}"[^>]*>[\\s\\S]*?<\\/row>`);
  return xml.match(re)?.[0] ?? "(not found)";
}

// Mostrar rows 37, 38, 55, 56, 57, 58 para entender estructura
for (const r of [37, 38, 55, 56, 57, 58, 59, 60]) {
  const xml = getRowXml(sheet, r);
  console.log(`\n--- ROW ${r} ---`);
  // Truncar si es muy largo
  if (xml.length > 800) {
    console.log(xml.slice(0, 800) + "...(truncado)");
  } else {
    console.log(xml);
  }
}

// Buscar la primera celda M en filas 57-60
console.log("\n=== CELDAS M EN FILAS 55-62 ===");
for (const r of [55, 56, 57, 58, 59, 60, 61, 62]) {
  const re = new RegExp(`<c r="M${r}"([^>]*)(?:/>|>[\\s\\S]*?<\\/c>)`);
  const m = sheet.match(re);
  console.log(`  M${r}: ${m ? m[0].slice(0, 120) : "(no encontrado)"}`);
}

// Mostrar dimension del worksheet
const dimMatch = sheet.match(/<dimension\s+ref="([^"]+)"/);
console.log(`\n=== DIMENSION: ${dimMatch?.[1] ?? "not found"} ===`);

// ¿Hay algún error en shared formulas con ref inválido?
console.log("\n=== SHARED FORMULAS (primeras 5) ===");
let fCount = 0;
for (const m of sheet.matchAll(/<f\b([^>]*)>([^<]*)<\/f>/g)) {
  const attrs = m[1];
  const formula = m[2];
  const refMatch = attrs.match(/\bref="([^"]+)"/);
  console.log(`  attrs: ${attrs.slice(0,80)} | formula: ${formula.slice(0,40)}`);
  if (++fCount >= 5) break;
}
