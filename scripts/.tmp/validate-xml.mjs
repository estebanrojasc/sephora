import { readFileSync } from "node:fs";

const xml = readFileSync("scripts/.tmp/test-ind-sheet.xml", "utf8");
const rowOpen = (xml.match(/<row\b/g) ?? []).length;
const rowClose = (xml.match(/<\/row>/g) ?? []).length;
console.log("rows", rowOpen, rowClose, rowOpen === rowClose ? "OK" : "BAD");
console.log("L<row", xml.includes("L<row") ? "BAD" : "OK");
