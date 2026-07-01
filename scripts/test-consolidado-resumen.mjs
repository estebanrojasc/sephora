import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../src/features/records/types.ts";
import { buildConsolidatedWorkbook } from "../src/features/excel/build-consolidated.ts";
import { buildBitacoraMetaBlock } from "../src/features/bitacora/meta.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function mockRecord(id, rec, conductor, bitacoraFields) {
  const extraction = createEmptyExtraction();
  extraction.conductor.valor = conductor;
  extraction.n_recorrido.valor = rec;
  extraction.observaciones.valor = "OBS OCR " + id;
  extraction._meta = {
    confidence: 1,
    processedImageIds: [],
    processedAt: new Date().toISOString(),
    source: "test",
    bitacora: buildBitacoraMetaBlock(
      {
        id: "b1",
        date: "2026-06-30",
        version: 1,
        rows: [],
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "row-" + id,
        patente: "AA1234",
        conductor: "BIT " + conductor,
        auxiliar: "AUX " + conductor,
        sector: "SECTOR " + id.toUpperCase(),
        recorrido: rec,
        cantFact: "10",
        montoTotal: "1000000",
        observacion: "OBS BIT " + id,
        ...bitacoraFields,
      },
      0.9,
      extraction
    ),
  };
  return {
    id,
    status: "saved",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    images: [],
    extraction,
  };
}

const r1 = mockRecord("r1", "111", "ANA", {});
const r2 = mockRecord("r2", "222", "BOB", {});

const out = unzipSync(buildConsolidatedWorkbook(template, [r1, r2]));
const strings = [];
for (const m of new TextDecoder()
  .decode(out["xl/sharedStrings.xml"])
  .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
  strings.push(m[1].replace(/<[^>]+>/g, ""));
}
const sheet = new TextDecoder().decode(out["xl/worksheets/sheet1.xml"]);

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

const checks = [
  ["B3 obs reg1", "OBS OCR r1", get("B3")],
  ["C3 obs reg2", "OBS OCR r2", get("C3")],
  ["B3 != C3", true, get("B3") !== get("C3") && get("B3") !== "VARIOS"],
  ["B4 sector reg1", "SECTOR R1", get("B4")],
  ["C4 sector reg2", "SECTOR R2", get("C4")],
  ["B8 sin auto-fill", true, get("B8") === "" || get("B8") === "(empty)"],
  ["B21 sin totales auto", true, get("B21") === "" || get("B21") === "(empty)"],
  ["A21 sin label total", true, get("A21") === "" || get("A21") === "(empty)"],
];

let ok = true;
for (const [label, expected, actual] of checks) {
  const pass =
    typeof expected === "boolean"
      ? actual === expected
      : String(actual).includes(String(expected));
  if (!pass) ok = false;
  console.log(pass ? "OK" : "FAIL", label, "expected contains", expected, "got", actual);
}

console.log(ok ? "PASS resumen rows 3-4" : "FAIL resumen rows 3-4");
