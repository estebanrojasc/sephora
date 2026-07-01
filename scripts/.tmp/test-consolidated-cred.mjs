import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../../src/features/records/types.ts";
import { buildConsolidatedWorkbook } from "../../src/features/excel/build-consolidated.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");

function record(id, credClients) {
  const extraction = createEmptyExtraction();
  extraction.n_recorrido.valor = id;
  extraction.detalle_credito_vendedor = credClients.map((c, i) => ({
    cliente: { valor: c, bbox: [0, 0, 0, 0] },
    no_fac: { valor: `F${i}`, bbox: [0, 0, 0, 0] },
    valor: { valor: String((i + 1) * 100), bbox: [0, 0, 0, 0] },
    nro_vendedor: { valor: `V${i}`, bbox: [0, 0, 0, 0] },
  }));
  return {
    id,
    status: "saved",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    images: [],
    extraction,
  };
}

const out = buildConsolidatedWorkbook(template, [
  record("r1", ["A1", "A2"]),
  record("r2", ["B1", "B2", "B3"]),
]);
const sheet = new TextDecoder().decode(
  unzipSync(out)["xl/worksheets/sheet1.xml"]
);
for (let r = 71; r <= 78; r++) {
  const m = sheet.match(new RegExp(`<c r="M${r}"[^>]*>([\\s\\S]*?)</c>`));
  const inline = m?.[1]?.match(/<t[^>]*>([^<]*)</)?.[1];
  const v = m?.[1]?.match(/<v>([^<]*)</)?.[1];
  console.log(`M${r}:`, inline ?? v ?? "-");
}
