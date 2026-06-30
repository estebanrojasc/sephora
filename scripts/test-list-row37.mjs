import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../src/features/records/types.ts";
import { buildRendicionPayload } from "../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function getCells(out, fromRow, toRow) {
  const f = unzipSync(out);
  const strings = [];
  for (const m of new TextDecoder()
    .decode(f["xl/sharedStrings.xml"])
    .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    strings.push(m[1].replace(/<[^>]+>/g, ""));
  }
  const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);
  function get(ref) {
    const re = new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`);
    const m = sheet.match(re);
    if (!m) return "";
    const attrs = m[1];
    const inner = m[2] ?? "";
    const vm = inner.match(/<v>(\d+)<\/v>/);
    if (vm && attrs.includes('t="s"')) return strings[parseInt(vm[1], 10)] ?? "";
    if (vm) return vm[1];
    const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
    return isT ? isT[1] : "";
  }
  const rows = [];
  for (let row = fromRow; row <= toRow; row++) {
    rows.push({
      row,
      m: get(`M${row}`),
      n: get(`N${row}`),
      o: get(`O${row}`),
      p: get(`P${row}`),
    });
  }
  return rows;
}

const extraction = createEmptyExtraction();
extraction.fecha.valor = "30-06-2026";
extraction.detalles_cheques = [
  {
    fecha: { valor: "15-07-2026", bbox: [0, 0, 0, 0] },
    banco: { valor: "SANTANDER", bbox: [0, 0, 0, 0] },
    valor: { valor: "100000", bbox: [0, 0, 0, 0] },
  },
  {
    fecha: { valor: "20-07-2026", bbox: [0, 0, 0, 0] },
    banco: { valor: "BCI", bbox: [0, 0, 0, 0] },
    valor: { valor: "200000", bbox: [0, 0, 0, 0] },
  },
  {
    fecha: { valor: "25-07-2026", bbox: [0, 0, 0, 0] },
    banco: { valor: "ESTADO", bbox: [0, 0, 0, 0] },
    valor: { valor: "300000", bbox: [0, 0, 0, 0] },
  },
  {
    fecha: { valor: "30-06-2026", bbox: [0, 0, 0, 0] },
    banco: { valor: "SCOTIA", bbox: [0, 0, 0, 0] },
    valor: { valor: "50000", bbox: [0, 0, 0, 0] },
  },
];
extraction.n_c_rechazo_total = [
  {
    no_fac: { valor: "111", bbox: [0, 0, 0, 0] },
    valor: { valor: "9000", bbox: [0, 0, 0, 0] },
  },
  {
    no_fac: { valor: "222", bbox: [0, 0, 0, 0] },
    valor: { valor: "8000", bbox: [0, 0, 0, 0] },
  },
];

const payload = buildRendicionPayload({
  id: "t",
  status: "saved",
  createdAt: "",
  updatedAt: "",
  images: [],
  extraction,
});

console.log("Payload counts:", {
  aFecha: payload.lists.cheques_a_fecha.length,
  alDia: payload.lists.cheques_al_dia.length,
  rech: payload.lists.rech_total.length,
});

const out = renderRendicionExcel(template, payload);
const rows = getCells(out, 37, 45);
for (const r of rows) {
  if (r.m || r.n || r.o || r.p) {
    console.log(
      `R${r.row}: M=${r.m} N=${r.n} O=${r.o} P=${r.p}`
    );
  }
}

const aFechaRows = rows.filter((r) => r.m.includes("07-2026") || r.m.includes("07/2026"));
const alDiaRows = rows.filter((r) => r.m.includes("30-06") || r.m.includes("30/06"));
const ok =
  aFechaRows.length === 3 &&
  alDiaRows.length >= 1 &&
  payload.lists.cheques_a_fecha.length === 3;
console.log(ok ? "PASS row37 expansion" : "FAIL row37 expansion", {
  aFechaRows: aFechaRows.length,
  alDiaRows: alDiaRows.length,
});
