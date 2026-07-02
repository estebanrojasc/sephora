import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const path = process.argv[2] ?? "scripts/.tmp/consolidado-test.xlsx";
const f = unzipSync(readFileSync(path));
const sh = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);
const wb = new TextDecoder().decode(f["xl/workbook.xml"]);
const rels = new TextDecoder().decode(
  f["xl/_rels/workbook.xml.rels"] ?? new Uint8Array()
);
const ct = new TextDecoder().decode(f["[Content_Types].xml"]);

console.log("file", path, "bytes", readFileSync(path).length);
console.log("rows", (sh.match(/<row\b/g) ?? []).length);
console.log("calcChain file", !!f["xl/calcChain.xml"]);
console.log("rels calcChain", /calcChain/.test(rels));
console.log("ct calcChain", /calcChain/.test(ct));
console.log("workbook sheets", wb.match(/<sheet[^>]+>/g));
console.log("broken I39:I39", (sh.match(/ref="I39:I39"/g) ?? []).length);
console.log("sample I39 cell", sh.match(/<c r="I39"[^>]*>[\s\S]*?<\/c>/)?.[0]?.slice(0, 180));

let mismatch = 0;
for (const m of sh.matchAll(/<row\b[^>]*\br="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)) {
  const rowNum = m[1];
  for (const c of m[2].matchAll(/<c r="([A-Z]+)(\d+)"/g)) {
    if (c[2] !== rowNum) mismatch++;
  }
}
console.log("row/cell r mismatch count", mismatch);

const strings = [];
for (const m of new TextDecoder()
  .decode(f["xl/sharedStrings.xml"])
  .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
  strings.push(m[1].replace(/<[^>]+>/g, ""));
}
let placeholders = 0;
for (const m of sh.matchAll(/<c r="([A-Z]+\d+)"([^>]*)>([\s\S]*?)<\/c>/g)) {
  const inner = m[3];
  const vm = inner.match(/<v>(\d+)<\/v>/);
  let val = "";
  if (vm && m[2].includes('t="s"')) val = strings[parseInt(vm[1], 10)] ?? "";
  const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
  if (isT) val = isT[1];
  if (val.includes("{{")) placeholders++;
}
console.log("leftover placeholders", placeholders);
console.log("B1", getCell(sh, strings, "B1"));
console.log("M37", getCell(sh, strings, "M37"));

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
