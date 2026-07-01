import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../src/features/records/types.ts";
import { buildRendicionPayload } from "../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../src/features/excel/render.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function parseStrings(bytes) {
  const strings = [];
  for (const m of new TextDecoder()
    .decode(bytes)
    .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    strings.push(m[1].replace(/<[^>]+>/g, ""));
  }
  return strings;
}

function getCell(sheet, strings, ref) {
  const m = sheet.match(
    new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`)
  );
  if (!m) return "(missing)";
  const inner = m[2] ?? "";
  const vm = inner.match(/<v>(\d+)<\/v>/);
  if (vm && m[1].includes('t="s"')) return strings[parseInt(vm[1], 10)] ?? "";
  const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
  if (isT) return isT[1];
  const vn = inner.match(/<v>([^<]+)<\/v>/);
  return vn ? vn[1] : "(empty)";
}

function getStyle(sheet, ref) {
  const m = sheet.match(new RegExp(`<c r="${ref}"([^>/]*)`));
  const sm = m?.[1]?.match(/\bs="(\d+)"/);
  return sm ? sm[1] : "?";
}

// Template inspection
const tpl = unzipSync(template);
const tplStrings = parseStrings(tpl["xl/sharedStrings.xml"]);
const tplSheet = new TextDecoder().decode(tpl["xl/worksheets/sheet1.xml"]);
console.log("=== TEMPLATE rows 36-42 ===");
for (let r = 36; r <= 42; r++) {
  console.log(
    `R${r}`,
    `M=${getCell(tplSheet, tplStrings, `M${r}`)}`,
    `N=${getCell(tplSheet, tplStrings, `N${r}`)}`,
    `O=${getCell(tplSheet, tplStrings, `O${r}`)}`,
    `sM=${getStyle(tplSheet, `M${r}`)}`
  );
}
console.log("=== TEMPLATE credito R71 ===");
for (const ref of ["L71", "M71", "R71", "S71", "T71", "V71"]) {
  console.log(ref, getCell(tplSheet, tplStrings, ref), `s=${getStyle(tplSheet, ref)}`);
}
const mergeMatches = [...tplSheet.matchAll(/<mergeCell ref="([^"]+)"/g)];
console.log(
  "merges 70-76",
  mergeMatches.filter((m) => /7[0-6]/.test(m[1])).map((m) => m[1])
);

// Render with cheques
const e = createEmptyExtraction();
e.detalles_cheques = [
  {
    fecha: { valor: "15/07/2026", bbox: [0, 0, 0, 0] },
    banco: { valor: "SANT", bbox: [0, 0, 0, 0] },
    valor: { valor: "100", bbox: [0, 0, 0, 0] },
  },
  {
    fecha: { valor: "30/06/2026", bbox: [0, 0, 0, 0] },
    banco: { valor: "BCI", bbox: [0, 0, 0, 0] },
    valor: { valor: "50", bbox: [0, 0, 0, 0] },
  },
];
const payload = buildRendicionPayload({
  id: "x",
  status: "saved",
  createdAt: "",
  updatedAt: "",
  images: [],
  extraction: e,
});
const out = renderRendicionExcel(template, payload);
const f = unzipSync(out);
const strings = parseStrings(f["xl/sharedStrings.xml"]);
const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);
console.log("\n=== RENDERED lists", payload.lists.cheques_al_dia.length, payload.lists.cheques_a_fecha.length);
for (let r = 36; r <= 45; r++) {
  console.log(
    `R${r}`,
    `M=${getCell(sheet, strings, `M${r}`)}`,
    `N=${getCell(sheet, strings, `N${r}`)}`,
    `O=${getCell(sheet, strings, `O${r}`)}`,
    `sM=${getStyle(sheet, `M${r}`)}`
  );
}

// Render with multiple credito
const cred = createEmptyExtraction();
cred.n_recorrido.valor = "260006344";
cred.detalle_credito_vendedor = [
  {
    cliente: { valor: "A", bbox: [0, 0, 0, 0] },
    no_fac: { valor: "1", bbox: [0, 0, 0, 0] },
    valor: { valor: "100", bbox: [0, 0, 0, 0] },
    nro_vendedor: { valor: "69", bbox: [0, 0, 0, 0] },
  },
  {
    cliente: { valor: "B", bbox: [0, 0, 0, 0] },
    no_fac: { valor: "2", bbox: [0, 0, 0, 0] },
    valor: { valor: "200", bbox: [0, 0, 0, 0] },
    nro_vendedor: { valor: "70", bbox: [0, 0, 0, 0] },
  },
];
const credOut = renderRendicionExcel(
  template,
  buildRendicionPayload({
    id: "c",
    status: "saved",
    createdAt: "",
    updatedAt: "",
    images: [],
    extraction: cred,
  })
);
const cf = unzipSync(credOut);
const cs = parseStrings(cf["xl/sharedStrings.xml"]);
const csh = new TextDecoder().decode(cf["xl/worksheets/sheet1.xml"]);
console.log("\n=== CREDITO rows 71-74 ===");
for (let r = 71; r <= 74; r++) {
  console.log(
    `R${r}`,
    `R=${getCell(csh, cs, `R${r}`)}`,
    `S=${getCell(csh, cs, `S${r}`)}`,
    `M=${getCell(csh, cs, `M${r}`)}`
  );
}

// Multiple cheques al dia (expansion)
const e2 = createEmptyExtraction();
e2.detalles_cheques = [
  { fecha: { valor: "30/06/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "BCI", bbox: [0, 0, 0, 0] }, valor: { valor: "50", bbox: [0, 0, 0, 0] } },
  { fecha: { valor: "29/06/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "BCI2", bbox: [0, 0, 0, 0] }, valor: { valor: "60", bbox: [0, 0, 0, 0] } },
  { fecha: { valor: "15/07/2026", bbox: [0, 0, 0, 0] }, banco: { valor: "SANT", bbox: [0, 0, 0, 0] }, valor: { valor: "100", bbox: [0, 0, 0, 0] } },
];
const p2 = buildRendicionPayload({ id: "x2", status: "saved", createdAt: "", updatedAt: "", images: [], extraction: e2 });
const out2 = renderRendicionExcel(template, p2);
const f2 = unzipSync(out2);
const s2 = parseStrings(f2["xl/sharedStrings.xml"]);
const sh2 = new TextDecoder().decode(f2["xl/worksheets/sheet1.xml"]);
console.log("\n=== 3 cheques al dia + 1 a fecha ===");
console.log("lists", p2.lists.cheques_al_dia.length, p2.lists.cheques_a_fecha.length);
for (let r = 36; r <= 45; r++) {
  const m = getCell(sh2, s2, `M${r}`);
  const ph = m.includes("{{") ? "PLACEHOLDER!" : m;
  console.log(`R${r}`, `M=${ph}`, `N=${getCell(sh2, s2, `N${r}`)}`, `O=${getCell(sh2, s2, `O${r}`)}`);
}

// Transferencias: etiqueta en cada fila
const te = createEmptyExtraction();
te.detalle_transferencias = [
  { cliente: { valor: "C1", bbox: [0, 0, 0, 0] }, no_fac: { valor: "1", bbox: [0, 0, 0, 0] }, valor: { valor: "10", bbox: [0, 0, 0, 0] }, banco: { valor: "B1", bbox: [0, 0, 0, 0] } },
  { cliente: { valor: "C2", bbox: [0, 0, 0, 0] }, no_fac: { valor: "2", bbox: [0, 0, 0, 0] }, valor: { valor: "20", bbox: [0, 0, 0, 0] }, banco: { valor: "B2", bbox: [0, 0, 0, 0] } },
  { cliente: { valor: "C3", bbox: [0, 0, 0, 0] }, no_fac: { valor: "3", bbox: [0, 0, 0, 0] }, valor: { valor: "30", bbox: [0, 0, 0, 0] }, banco: { valor: "B3", bbox: [0, 0, 0, 0] } },
];
const tf = unzipSync(
  renderRendicionExcel(
    template,
    buildRendicionPayload({ id: "t", status: "saved", createdAt: "", updatedAt: "", images: [], extraction: te })
  )
);
const ts = parseStrings(tf["xl/sharedStrings.xml"]);
const tsh = new TextDecoder().decode(tf["xl/worksheets/sheet1.xml"]);
console.log("\n=== 3 transferencias ===");
for (let r = 73; r <= 77; r++) {
  console.log(`R${r}`, `R=${getCell(tsh, ts, `R${r}`)}`, `M=${getCell(tsh, ts, `M${r}`)}`);
}
