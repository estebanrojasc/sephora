import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";

function inspect(path) {
  const f = unzipSync(readFileSync(path));
  const sheet = new TextDecoder().decode(f["xl/worksheets/sheet1.xml"]);
  const rows = [...sheet.matchAll(/<row\b[^>]*\br="(\d+)"/g)].map((m) =>
    parseInt(m[1], 10)
  );
  const maxRow = Math.max(...rows);
  const dupRows = rows.filter((r, i) => rows.indexOf(r) !== i);
  const dim = sheet.match(/<dimension ref="([^"]+)"/)?.[1];
  console.log(`\n=== ${path} ===`);
  console.log("dimension:", dim);
  console.log("row count:", rows.length, "maxRow:", maxRow);
  if (dupRows.length) console.log("DUPLICATE rows:", [...new Set(dupRows)].slice(0, 20));

  const strings = [];
  for (const m of new TextDecoder()
    .decode(f["xl/sharedStrings.xml"])
    .matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    strings.push(m[1].replace(/<[^>]+>/g, ""));
  }
  const placeholders = strings.filter((s) => s.includes("{{"));
  console.log("unreplaced placeholders in sharedStrings:", placeholders.length);
  if (placeholders.length) placeholders.slice(0, 5).forEach((p) => console.log(" ", p));

  // cells still pointing to placeholder strings
  let stale = 0;
  for (const m of sheet.matchAll(/<c\b[^>]*>\s*<v>(\d+)<\/v>\s*<\/c>/g)) {
    const s = strings[parseInt(m[1], 10)];
    if (s?.includes("{{")) stale++;
  }
  console.log("cells still with placeholder shared string:", stale);
}

inspect("templates/RUTA CFT-ABL -2026.xlsx");
inspect("scripts/.tmp/rendicion-test-output.xlsx");
