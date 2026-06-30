import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");
const f = unzipSync(template);
const strings = [];
for (const m of new TextDecoder()
  .decode(f["xl/sharedStrings.xml"])
  .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
  strings.push(m[1].replace(/<[^>]+>/g, ""));
}
const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);

for (const ref of ["L71", "M71", "N71", "P71", "Q71", "S71", "T71", "U71", "V71"]) {
  const re = new RegExp(`<c r="${ref}"([^>/]*)(?:/>|>([\\s\\S]*?)<\\/c>)`);
  const m = sheet.match(re);
  if (!m) {
    console.log(ref, "MISSING");
    continue;
  }
  const attrs = m[1];
  const inner = m[2] ?? "";
  const vm = inner.match(/<v>(\d+)<\/v>/);
  let val = "";
  if (vm && attrs.includes('t="s"')) val = strings[parseInt(vm[1], 10)] ?? `idx:${vm[1]}`;
  else if (vm) val = vm[1];
  else {
    const isT = inner.match(/<is>[\s\S]*?<t[^>]*>([^<]*)<\/t>/);
    val = isT ? isT[1] : "(empty)";
  }
  console.log(ref, "s=" + (attrs.match(/\bs="(\d+)"/)?.[1] ?? "?"), val);
}
