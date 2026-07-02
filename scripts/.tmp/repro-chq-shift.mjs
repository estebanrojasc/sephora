import { readFileSync, writeFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../../src/features/records/types.ts";
import { buildRendicionPayload } from "../../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");
const e = createEmptyExtraction();
e.fecha = { valor: "30/06/2026", bbox: [0, 0, 0, 0] };
e.n_recorrido = { valor: "260006344", bbox: [0, 0, 0, 0] };

// 18 cheques al día (como en export del usuario)
const alDia = Array.from({ length: 18 }, (_, i) => ({
  fecha: { valor: "30/06/2026", bbox: [0, 0, 0, 0] },
  banco: { valor: `BANCO${i + 1}`, bbox: [0, 0, 0, 0] },
  valor: { valor: String(10000 * (i + 1)), bbox: [0, 0, 0, 0] },
}));

// 4 cheques a fecha
const aFecha = [
  { fecha: { valor: "15/07/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "BCI", bbox: [0, 0, 0, 0] }, valor: { valor: "127092", bbox: [0, 0, 0, 0] } },
  { fecha: { valor: "20/07/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "SANTANDER", bbox: [0, 0, 0, 0] }, valor: { valor: "972618", bbox: [0, 0, 0, 0] } },
  { fecha: { valor: "25/07/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "ITAU", bbox: [0, 0, 0, 0] }, valor: { valor: "368449", bbox: [0, 0, 0, 0] } },
  { fecha: { valor: "30/07/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "ESTADO", bbox: [0, 0, 0, 0] }, valor: { valor: "92552", bbox: [0, 0, 0, 0] } },
];

e.detalles_cheques = [...alDia, ...aFecha];

const record = { id: "repro", status: "saved", createdAt: "", updatedAt: "", images: [], extraction: e };
const payload = buildRendicionPayload(record);
console.log("al_dia:", payload.lists.cheques_al_dia.length);
console.log("a_fecha:", payload.lists.cheques_a_fecha.length);

const out = renderRendicionExcel(template, payload);
writeFileSync("scripts/.tmp/repro-shift.xlsx", out);

const sheet = new TextDecoder().decode(unzipSync(out)["xl/worksheets/sheet1.xml"]);
const strs = [];
for (const m of new TextDecoder().decode(unzipSync(out)["xl/sharedStrings.xml"]).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g))
  strs.push(m[1].replace(/<[^>]+>/g, ""));

function cell(ref) {
  const m = sheet.match(new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`));
  if (!m) return "MISSING";
  const inner = m[2] ?? "";
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && /t="s"/.test(m[1])) return strs[+vm[1]] ?? vm[1];
  const isT = inner.match(/<t[^>]*>([^<]*)<\/t>/);
  if (isT) return isT[1];
  const vn = inner.match(/<v>([^<]+)<\/v>/);
  return vn ? vn[1] : "(empty)";
}

console.log("\n=== CHEQUES A FECHA (buscar filas con valores) ===");
for (let r = 50; r <= 65; r++) {
  const m = cell(`M${r}`), n = cell(`N${r}`), o = cell(`O${r}`);
  if (m !== "MISSING" || n !== "MISSING" || o !== "MISSING") {
    if (m !== "(empty)" || n !== "(empty)" || (o !== "(empty)" && o !== "MISSING"))
      console.log(`R${r}: M=${m} N=${n} O=${o}`);
  }
}
