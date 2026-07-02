import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../../src/features/records/types.ts";
import { buildConsolidatedWorkbook } from "../../src/features/excel/build-consolidated.ts";
import { buildRendicionPayload } from "../../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function parseCells(body) {
  const cells = [];
  let i = 0;
  while (i < body.length) {
    const start = body.indexOf("<c", i);
    if (start === -1) break;
    if (body[start + 2] !== " " && body[start + 2] !== ">") {
      i = start + 2;
      continue;
    }
    const gt = body.indexOf(">", start);
    if (gt === -1) break;
    const end = gt > 0 && body[gt - 1] === "/" ? gt + 1 : body.indexOf("</c>", gt) + 4;
    if (end <= gt) break;
    cells.push(body.slice(start, end));
    i = end;
  }
  return cells;
}

function countBad(xml) {
  let n = 0;
  for (const m of xml.matchAll(/<row\b([^>]*)\br="(\d+)"([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowNum = m[2];
    const seen = new Set();
    for (const cell of parseCells(m[4])) {
      const ref = cell.match(/\br="([A-Z]+)(\d+)"/);
      if (!ref) continue;
      if (ref[2] !== rowNum) n++;
      const key = ref[1] + ref[2];
      if (seen.has(key)) n++;
      seen.add(key);
    }
  }
  const opens = (xml.match(/<row\b/g) ?? []).length;
  const closes = (xml.match(/<\/row>/g) ?? []).length;
  if (opens !== closes) n += 1000;
  return n;
}

function pedro() {
  const e = createEmptyExtraction();
  e.fecha.valor = "30-06-2026";
  e.conductor.valor = "PEDRO";
  e.detalles_cheques = [
    { fecha: { valor: "30-07-2026", bbox: [0,0,0,0] }, banco: { valor: "BCI", bbox: [0,0,0,0] }, valor: { valor: "368449", bbox: [0,0,0,0] } },
  ];
  return { id: "p", status: "saved", createdAt: "", updatedAt: "", images: [], extraction: e };
}

function heavyExtraction() {
  const e = createEmptyExtraction();
  e.n_c_rechazo_total = Array.from({ length: 17 }, (_, i) => ({
    no_fac: { valor: String(605655 + i), bbox: [0,0,0,0] },
    valor: { valor: String(10000 + i), bbox: [0,0,0,0] },
  }));
  return e;
}

const cases = [
  ["pedro", renderRendicionExcel(template, buildRendicionPayload(pedro()))],
  ["heavy", renderRendicionExcel(template, buildRendicionPayload({ id: "h", status: "saved", createdAt: "", updatedAt: "", images: [], extraction: heavyExtraction() }))],
  ["cons", buildConsolidatedWorkbook(template, [pedro(), pedro()])],
];

let failed = false;
for (const [name, bytes] of cases) {
  const xml = new TextDecoder().decode(unzipSync(bytes)["xl/worksheets/sheet1.xml"]);
  const bad = countBad(xml);
  console.log(name, bad === 0 ? "OK" : `FAIL (${bad})`);
  if (bad) failed = true;
}
process.exit(failed ? 1 : 0);
