import { readFileSync } from "node:fs";

const xml = readFileSync("scripts/.tmp/test-ind-sheet.xml", "utf8");
const sdStart = xml.indexOf("<sheetData>");
const sdEnd = xml.indexOf("</sheetData>");
const body = xml.slice(sdStart + 11, sdEnd);

const opens = [...body.matchAll(/<row\b[^>]*>/g)];
console.log("opens:", opens.length);

for (let i = 0; i < opens.length; i++) {
  const start = opens[i].index;
  const afterOpen = start + opens[i][0].length;
  const closeIdx = body.indexOf("</row>", afterOpen);
  const nextOpen =
    i + 1 < opens.length ? opens[i + 1].index : body.length;
  const rowNum = opens[i][0].match(/\br="(\d+)"/)?.[1] ?? "?";
  if (closeIdx === -1 || closeIdx > nextOpen) {
    console.log(`\n=== BAD ROW #${i + 1} r=${rowNum} at ${start} ===`);
    console.log("open:", opens[i][0]);
    console.log("body snippet:", body.slice(start, start + 500));
    if (closeIdx !== -1 && closeIdx > nextOpen) {
      console.log("close after next open:", closeIdx, "nextOpen", nextOpen);
    }
  }
}
