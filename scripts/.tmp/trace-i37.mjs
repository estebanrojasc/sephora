import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { buildRendicionPayload } from "../../src/features/excel/build-rendicion.ts";
import { createEmptyExtraction } from "../../src/features/records/types.ts";

const template = readFileSync("templates/RUTA CFT-ABL -2026.xlsx");
const tplXml = new TextDecoder().decode(
  unzipSync(template)["xl/worksheets/sheet1.xml"]
);
const i37tpl = tplXml.match(/<row\b[^>]*\br="37"[^>]*>[\s\S]*?<\/row>/)?.[0] ?? "";
console.log("TEMPLATE I37 cell:", i37tpl.match(/<c r="I37"[\s\S]*?<\/c>/)?.[0]);

const e = createEmptyExtraction();
e.fecha.valor = "30-06-2026";
e.conductor.valor = "PEDRO";
e.n_recorrido.valor = "260006320";
e.detalles_cheques = [
  {
    fecha: { valor: "30-07-2026", bbox: [0, 0, 0, 0] },
    banco: { valor: "BCI", bbox: [0, 0, 0, 0] },
    valor: { valor: "368449", bbox: [0, 0, 0, 0] },
  },
];
const rec = {
  id: "p",
  status: "saved",
  createdAt: "",
  updatedAt: "",
  images: [],
  extraction: e,
};
const payload = buildRendicionPayload(rec);

// Import render internals via dynamic - use renderRendicionWorksheet only
const { renderRendicionWorksheet } = await import("../../src/features/excel/render.ts");
const out = renderRendicionWorksheet(template, payload);
const i37out = out.match(/<row\b[^>]*\br="37"[^>]*>[\s\S]*?<\/row>/)?.[0] ?? "";
console.log("OUTPUT I37 cell:", i37out.match(/<c r="I37"[\s\S]*?<\/c>/)?.[0]);
console.log("has L<row", out.includes("L<row"));
