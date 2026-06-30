import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { unzipSync } from "fflate";
import { createEmptyExtraction } from "../src/features/records/types.ts";
import { buildRendicionPayload } from "../src/features/excel/build-rendicion.ts";
import { renderRendicionExcel } from "../src/features/excel/render.ts";

mkdirSync("scripts/.tmp", { recursive: true });
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
    const m = get(`M${row}`);
    const u = get(`U${row}`);
    if (m || u) rows.push({ row, m, u });
  }
  return rows;
}

function run(label, nTransf, nCred = 1) {
  const extraction = createEmptyExtraction();
  extraction.n_recorrido.valor = "99999";
  extraction.detalle_credito_vendedor = Array.from({ length: nCred }, (_, i) => ({
    no_fac: { valor: `C${i}`, bbox: [0, 0, 0, 0] },
    valor: { valor: "1000", bbox: [0, 0, 0, 0] },
    cliente: { valor: `CRED-${i + 1}`, bbox: [0, 0, 0, 0] },
    nro_vendedor: { valor: "1", bbox: [0, 0, 0, 0] },
  }));
  extraction.detalle_transferencias = Array.from({ length: nTransf }, (_, i) => ({
    no_fac: { valor: `F${i}`, bbox: [0, 0, 0, 0] },
    valor: { valor: String(100000 * (i + 1)), bbox: [0, 0, 0, 0] },
    cliente: { valor: `CLI-${i + 1}`, bbox: [0, 0, 0, 0] },
    banco: { valor: ["VE", "S", "E"][i % 3], bbox: [0, 0, 0, 0] },
  }));
  const out = renderRendicionExcel(
    template,
    buildRendicionPayload({
      id: "t",
      status: "saved",
      createdAt: "",
      updatedAt: "",
      images: [],
      extraction,
    })
  );
  const cells = getCells(out, 71, 85);
  const transf = cells.filter((c) => c.m.startsWith("CLI-"));
  const ok = transf.length === nTransf;
  console.log(
    ok ? "OK" : "FAIL",
    label,
    `transf=${transf.length}/${nTransf}`,
    transf.map((c) => `M${c.row}=${c.m}`).join(" ")
  );
  const faltante = cells.find((c) => c.m.includes("FALTANTE"));
  if (faltante) console.log("  FALTANTE at M" + faltante.row, faltante.m);
  return ok;
}

let ok = true;
ok &&= run("1 transf", 1);
ok &&= run("2 transf", 2);
ok &&= run("4 transf", 4);
ok &&= run("5 transf", 5);
ok &&= run("3 cred 4 transf", 4, 3);
console.log(ok ? "PASS" : "FAIL");
