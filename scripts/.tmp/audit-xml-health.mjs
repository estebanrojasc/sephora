import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../../src/features/records/types.ts";
import { buildConsolidatedWorkbook } from "../../src/features/excel/build-consolidated.ts";
import { buildRendicionPayload } from "../../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function bitacora(excel) {
  return {
    bitacoraId: "x", rowId: "y", version: 1, matchScore: 0,
    suggested: {}, recognized: {}, applied: {}, excel,
  };
}

function heavyRecord(id, rec, chqValor) {
  const e = createEmptyExtraction();
  e.fecha.valor = "30/06/2026";
  e.conductor.valor = "CRISTIAN";
  e.n_recorrido.valor = rec;
  e.cant_fact.valor = "5";
  e.valor_total.valor = "1000000";
  e.rendicion.cheques_a_fecha.valor = chqValor;
  e.detalles_cheques = [
    { fecha: { valor: "30/07/2026", bbox: [0,0,0,0] }, banco: { valor: "BCI", bbox: [0,0,0,0] }, valor: { valor: chqValor, bbox: [0,0,0,0] } },
  ];
  e.n_c_rechazo_total = Array.from({ length: 17 }, (_, i) => ({
    no_fac: { valor: String(605655 + i), bbox: [0,0,0,0] },
    valor: { valor: String(10000 + i), bbox: [0,0,0,0] },
  }));
  e._meta = { bitacora: bitacora({ conductor: "CRISTIAN", recorrido: rec, n_factura: "5", total_factura: "1000000" }) };
  return { id, status: "saved", createdAt: "", updatedAt: "", images: [], extraction: e };
}

function pedroRecord() {
  const e = createEmptyExtraction();
  e.fecha.valor = "30-06-2026";
  e.conductor.valor = "PEDRO";
  e.n_recorrido.valor = "260006320";
  e.cant_fact.valor = "5";
  e.valor_total.valor = "1.054.260";
  e.rendicion.cheques_a_fecha.valor = "461.001";
  e.detalles_cheques = [
    { fecha: { valor: "30-07-2026", bbox: [0,0,0,0] }, banco: { valor: "BCI", bbox: [0,0,0,0] }, valor: { valor: "368449", bbox: [0,0,0,0] } },
    { fecha: { valor: "30-07-2026", bbox: [0,0,0,0] }, banco: { valor: "BCI", bbox: [0,0,0,0] }, valor: { valor: "92.552", bbox: [0,0,0,0] } },
  ];
  e._meta = { bitacora: bitacora({ conductor: "PEDRO", recorrido: "260006320", n_factura: "5", total_factura: "1.054.260" }) };
  return { id: "p", status: "saved", createdAt: "", updatedAt: "", images: [], extraction: e };
}

function auditSheet(xml, label) {
  console.log(`\n========== ${label} ==========`);
  const issues = [];

  for (const m of xml.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
    const rowNum = m[1];
    const body = m[2];
    const refs = new Map();
    for (const c of body.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*)>([\s\S]*?)<\/c>|<c r="([A-Z]+)(\d+)"([^/]*)\/>/g)) {
      const col = c[1] ?? c[5];
      const cellRow = c[2] ?? c[6];
      const ref = `${col}${cellRow}`;
      if (cellRow !== rowNum) issues.push(`MISMATCH row ${rowNum}: cell ${ref}`);
      refs.set(ref, (refs.get(ref) ?? 0) + 1);
    }
    for (const [ref, count] of refs) {
      if (count > 1) issues.push(`DUPLICATE row ${rowNum}: ${ref} x${count}`);
    }
  }

  const ph = (xml.match(/\{\{[^}]+\}\}/g) ?? []).length;
  if (ph) issues.push(`PLACEHOLDERS left: ${ph}`);

  const dim = xml.match(/dimension\s+ref="([^"]+)"/)?.[1];
  const rowNums = [...xml.matchAll(/<row\b[^>]*\br="(\d+)"/g)].map((x) => +x[1]);
  console.log("dimension:", dim, "maxRow:", Math.max(...rowNums));

  if (issues.length === 0) console.log("No structural issues");
  else {
    console.log(`ISSUES (${issues.length}):`);
    issues.slice(0, 40).forEach((i) => console.log(" ", i));
  }
  return issues;
}

const records = [heavyRecord("h1", "260006341", "127092"), heavyRecord("h2", "260006342", "972618"), pedroRecord()];
const cons = buildConsolidatedWorkbook(template, records);
writeFileSync("scripts/.tmp/audit-cons.xlsx", cons);
const consXml = new TextDecoder().decode(unzipSync(cons)["xl/worksheets/sheet1.xml"]);
const ind = renderRendicionExcel(template, buildRendicionPayload(pedroRecord()));
const indXml = new TextDecoder().decode(unzipSync(ind)["xl/worksheets/sheet1.xml"]);

auditSheet(indXml, "INDIVIDUAL");
const issues = auditSheet(consXml, "CONSOLIDADO");
process.exit(issues.length ? 1 : 0);
