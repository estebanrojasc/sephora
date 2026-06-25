import { unzipSync, zipSync } from "fflate";
import type { Record as AppRecord } from "@/features/records/types";
import { buildRendicionPayload } from "./build-rendicion";
import {
  renderConsolidatedResumenWorksheet,
  renderRendicionWorksheet,
} from "./render";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeSheetName(name: string): string {
  return name.replace(/[:\\/?*[\]]/g, "").slice(0, 31) || "Ruta";
}

function sheetNameForRecord(record: AppRecord, used: Set<string>): string {
  const rec = record.extraction?.n_recorrido?.valor?.trim();
  let base = rec ? `RUTA ${rec}` : `Rec ${record.id.slice(0, 8)}`;
  base = sanitizeSheetName(base);
  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    const suffix = ` (${n})`;
    candidate = sanitizeSheetName(base.slice(0, 31 - suffix.length) + suffix);
    n++;
  }
  used.add(candidate);
  return candidate;
}

/**
 * Libro consolidado: hoja 1 = Resumen (misma plantilla, columnas B+ por registro),
 * hojas 2+ = detalle RUTA por registro (igual que el Excel individual).
 */
export function buildConsolidatedWorkbook(
  template: Uint8Array,
  records: AppRecord[]
): Uint8Array {
  if (records.length === 0) {
    throw new Error("Se requiere al menos un registro");
  }

  const baseFiles = unzipSync(template);
  const files: Record<string, Uint8Array> = { ...baseFiles };
  const sheetRelsTemplate = baseFiles["xl/worksheets/_rels/sheet1.xml.rels"];
  const totalSheets = 1 + records.length;

  files["xl/worksheets/sheet1.xml"] = encoder.encode(
    renderConsolidatedResumenWorksheet(template, records)
  );
  if (sheetRelsTemplate) {
    files["xl/worksheets/_rels/sheet1.xml.rels"] = sheetRelsTemplate;
  }

  const usedNames = new Set<string>(["Resumen"]);
  const sheetEntries: { name: string; path: string; rId: string }[] = [
    { name: "Resumen", path: "worksheets/sheet1.xml", rId: "rId1" },
  ];

  let nextRId = 6;

  for (let i = 0; i < records.length; i++) {
    const record = records[i]!;
    const sheetNum = i + 2;
    const sheetPath = `xl/worksheets/sheet${sheetNum}.xml`;
    const payload = buildRendicionPayload(record);
    files[sheetPath] = encoder.encode(
      renderRendicionWorksheet(template, payload)
    );

    if (sheetRelsTemplate) {
      files[`xl/worksheets/_rels/sheet${sheetNum}.xml.rels`] = sheetRelsTemplate;
    }

    sheetEntries.push({
      name: sheetNameForRecord(record, usedNames),
      path: `worksheets/sheet${sheetNum}.xml`,
      rId: `rId${nextRId++}`,
    });
  }

  let workbookXml = decoder.decode(baseFiles["xl/workbook.xml"]!);
  const sheetsXml = sheetEntries
    .map(
      (s, idx) =>
        `<sheet name="${escapeXml(s.name)}" sheetId="${idx + 1}" r:id="${s.rId}"/>`
    )
    .join("");
  workbookXml = workbookXml.replace(
    /<sheets>[\s\S]*?<\/sheets>/,
    `<sheets>${sheetsXml}</sheets>`
  );
  workbookXml = workbookXml.replace(
    /<calcPr\b[^/>]*\/>|<calcPr\b[^>]*>[\s\S]*?<\/calcPr>/,
    '<calcPr calcMode="auto" fullCalcOnLoad="1"/>'
  );
  files["xl/workbook.xml"] = encoder.encode(workbookXml);

  let relsXml = decoder.decode(baseFiles["xl/_rels/workbook.xml.rels"]!);
  relsXml = relsXml.replace(/<Relationship[^>]*calcChain[^>]*\/>/g, "");
  relsXml = relsXml.replace(
    /<Relationship Id="rId1"[^>]*worksheet[^>]*\/>/,
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${sheetEntries[0]!.path}"/>`
  );
  for (const entry of sheetEntries.slice(1)) {
    relsXml = relsXml.replace(
      "</Relationships>",
      `<Relationship Id="${entry.rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="${entry.path}"/></Relationships>`
    );
  }
  files["xl/_rels/workbook.xml.rels"] = encoder.encode(relsXml);

  let ctXml = decoder.decode(baseFiles["[Content_Types].xml"]!);
  ctXml = ctXml.replace(/<Override[^>]*calcChain[^>]*\/>/g, "");
  for (let i = 1; i <= totalSheets; i++) {
    const part = `/xl/worksheets/sheet${i}.xml`;
    if (!ctXml.includes(part)) {
      ctXml = ctXml.replace(
        "</Types>",
        `<Override PartName="${part}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`
      );
    }
  }
  for (let i = totalSheets + 1; i <= 10; i++) {
    const part = `/xl/worksheets/sheet${i}.xml`;
    ctXml = ctXml.replace(
      new RegExp(`<Override PartName="${part.replace(/\//g, "\\/")}"[^>]*\\/>`, "g"),
      ""
    );
    delete files[`xl/worksheets/sheet${i}.xml`];
    delete files[`xl/worksheets/_rels/sheet${i}.xml.rels`];
  }

  delete files["xl/calcChain.xml"];
  files["[Content_Types].xml"] = encoder.encode(ctXml);

  return zipSync(files, { level: 6 });
}

export function buildConsolidatedFilename(recordCount: number): string {
  const [y, m, d] = new Date()
    .toLocaleDateString("en-CA", { timeZone: "America/Santiago" })
    .split("-");
  return `${d}${m}${y?.slice(-2)}_consolidado_${recordCount}reg.xlsx`;
}
