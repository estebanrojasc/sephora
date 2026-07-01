import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const t = unzipSync(readFileSync("templates/RUTA CFT-ABL -2026.xlsx"));
const sheet = new TextDecoder().decode(t["xl/worksheets/sheet1.xml"]);
for (const row of [71, 72, 73]) {
  const m = sheet.match(
    new RegExp(`<row\\b[^>]*\\br="${row}"[^>]*>[\\s\\S]*?</row>`)
  );
  if (m) {
    const cells = [...m[0].matchAll(/<c r="([A-Z]+\d+)"/g)].map((x) => x[1]);
    console.log("Row", row, "cells:", cells.join(", "));
  }
}

// Find rows with cred_cliente shared string
const ss = new TextDecoder().decode(t["xl/sharedStrings.xml"]);
let idx = 0;
let credIdx = -1;
for (const m of ss.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
  const text = m[1].replace(/<[^>]+>/g, "");
  if (text === "{{cred_cliente}}") credIdx = idx;
  idx++;
}
console.log("cred_cliente string index:", credIdx);
if (credIdx >= 0) {
  for (const m of sheet.matchAll(/<c r="([A-Z]+)(\d+)"[^>]*>\s*<v>(\d+)<\/v>/g)) {
    if (parseInt(m[3], 10) === credIdx) {
      console.log("cred placeholder at", m[1] + m[2]);
    }
  }
}

// rendicion scalars in row >= 22
for (const ph of [
  "extraction.rendicion.cheques_al_dia.valor",
  "extraction.rendicion.detalles_cheques.total_billetes.valor",
]) {
  let pidx = -1;
  idx = 0;
  for (const m of ss.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const text = m[1].replace(/<[^>]+>/g, "");
    if (text === `{{${ph}}}`) pidx = idx;
    idx++;
  }
  console.log("\n", ph, "index", pidx);
  if (pidx >= 0) {
    for (const m of sheet.matchAll(/<c r="([A-Z]+)(\d+)"[^>]*>\s*<v>(\d+)<\/v>/g)) {
      if (parseInt(m[3], 10) === pidx) {
        console.log("  at", m[1] + m[2]);
      }
    }
  }
}
