import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../src/features/records/types.ts";
import { buildRendicionPayload } from "../src/features/excel/build-rendicion.ts";
import {
  LIST_PLACEHOLDER_REGISTRY,
  PLACEHOLDER_PATTERN,
} from "../src/features/excel/placeholder-registry.ts";
import {
  listTemplatePlaceholders,
  parseTemplatePlaceholderIndices,
  scanWorksheetPlaceholders,
} from "../src/features/excel/template-scan.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");
const files = unzipSync(template);
const ssXml = new TextDecoder().decode(files["xl/sharedStrings.xml"]);
const sheetXml = new TextDecoder().decode(files["xl/worksheets/sheet1.xml"]);
const indices = parseTemplatePlaceholderIndices(ssXml);
const cells = scanWorksheetPlaceholders(sheetXml, indices);
const inTemplate = listTemplatePlaceholders(ssXml);

const extraction = createEmptyExtraction();
const payload = buildRendicionPayload({
  id: "audit",
  status: "saved",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  images: [],
  extraction,
});

console.log("=== Placeholders en plantilla (sharedStrings) ===");
for (const ph of inTemplate) {
  const cellRefs = cells
    .filter((c) => c.placeholder === ph)
    .map((c) => `${c.col}${c.row}`)
    .join(", ");
  console.log(`${ph}`);
  console.log(`  celdas: ${cellRefs || "(solo en pool, sin celda)"}`);
}

console.log("\n=== Cobertura ===");
const unmappedScalar = [];
const coveredList = new Set();

for (const ph of inTemplate) {
  if (ph.startsWith("{{extraction.")) {
    if (!(ph in payload.scalars)) unmappedScalar.push(ph);
  } else if (ph in LIST_PLACEHOLDER_REGISTRY) {
    coveredList.add(ph);
  } else if (PLACEHOLDER_PATTERN.test(ph)) {
    unmappedScalar.push(ph);
  }
}

const inSheetUnknown = cells
  .map((c) => c.placeholder)
  .filter(
    (ph) =>
      !ph.startsWith("{{extraction.") &&
      !(ph in LIST_PLACEHOLDER_REGISTRY)
  );

console.log(
  "Scalars extraction cubiertos:",
  inTemplate.filter((p) => p.startsWith("{{extraction.") && p in payload.scalars)
    .length,
  "/",
  inTemplate.filter((p) => p.startsWith("{{extraction.")).length
);
console.log(
  "Listas cubiertas en hoja:",
  [...new Set(cells.map((c) => c.placeholder))].filter(
    (p) => p in LIST_PLACEHOLDER_REGISTRY
  ).length
);

if (unmappedScalar.length) {
  console.log("\n⚠ Sin mapeo en código:");
  unmappedScalar.forEach((p) => console.log(" ", p));
}
if (inSheetUnknown.length) {
  console.log("\n⚠ En hoja pero no en LIST_PLACEHOLDER_REGISTRY:");
  [...new Set(inSheetUnknown)].forEach((p) => console.log(" ", p));
}

const inRegistryNotInTemplate = Object.keys(LIST_PLACEHOLDER_REGISTRY).filter(
  (p) => !inTemplate.includes(p)
);
if (inRegistryNotInTemplate.length) {
  console.log("\n(i) Registrados en código, ausentes en plantilla:");
  inRegistryNotInTemplate.forEach((p) => console.log(" ", p));
}
