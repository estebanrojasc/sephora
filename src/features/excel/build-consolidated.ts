import { unzipSync, zipSync } from "fflate";
import type { Record as AppRecord } from "@/features/records/types";
import { formatChileanDate, parseToIso } from "@/lib/date-utils";
import { renderConsolidatedResumenWorksheet } from "./render";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

/** Libro consolidado: una sola hoja Resumen (columnas B+ por registro + detalle fusionado). */
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

  files["xl/worksheets/sheet1.xml"] = encoder.encode(
    renderConsolidatedResumenWorksheet(template, records)
  );
  if (sheetRelsTemplate) {
    files["xl/worksheets/_rels/sheet1.xml.rels"] = sheetRelsTemplate;
  }

  for (let i = 2; i <= 10; i++) {
    delete files[`xl/worksheets/sheet${i}.xml`];
    delete files[`xl/worksheets/_rels/sheet${i}.xml.rels`];
  }

  let workbookXml = decoder.decode(baseFiles["xl/workbook.xml"]!);
  workbookXml = workbookXml.replace(
    /<sheets>[\s\S]*?<\/sheets>/,
    `<sheets><sheet name="Resumen" sheetId="1" r:id="rId1"/></sheets>`
  );
  workbookXml = workbookXml.replace(
    /<calcPr\b[^/>]*\/>|<calcPr\b[^>]*>[\s\S]*?<\/calcPr>/,
    '<calcPr calcMode="auto" fullCalcOnLoad="1"/>'
  );
  files["xl/workbook.xml"] = encoder.encode(workbookXml);

  let relsXml = decoder.decode(baseFiles["xl/_rels/workbook.xml.rels"]!);
  relsXml = relsXml.replace(/<Relationship[^>]*calcChain[^>]*\/>/g, "");
  relsXml = relsXml.replace(
    /<Relationship Id="rId\d+"[^>]*worksheets\/sheet(?!1)[^>]*\/>/g,
    ""
  );
  relsXml = relsXml.replace(
    /<Relationship Id="rId1"[^>]*worksheet[^>]*\/>/,
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>`
  );
  files["xl/_rels/workbook.xml.rels"] = encoder.encode(relsXml);

  let ctXml = decoder.decode(baseFiles["[Content_Types].xml"]!);
  ctXml = ctXml.replace(/<Override[^>]*calcChain[^>]*\/>/g, "");
  for (let i = 2; i <= 10; i++) {
    const part = `/xl/worksheets/sheet${i}.xml`;
    ctXml = ctXml.replace(
      new RegExp(`<Override PartName="${part.replace(/\//g, "\\/")}"[^>]*\\/>`, "g"),
      ""
    );
  }
  files["[Content_Types].xml"] = encoder.encode(ctXml);

  delete files["xl/calcChain.xml"];

  return zipSync(files, { level: 6 });
}

function consolidatedDateLabel(records: AppRecord[]): string {
  for (const record of records) {
    const fecha = record.extraction?.fecha?.valor?.trim();
    if (fecha) {
      const iso = parseToIso(fecha);
      if (iso) return formatChileanDate(iso);
      return fecha.replace(/\//g, "-");
    }
  }

  const created = records[0]?.createdAt;
  if (created) {
    const iso = new Date(created).toLocaleDateString("en-CA", {
      timeZone: "America/Santiago",
    });
    return formatChileanDate(iso);
  }

  return "sin-fecha";
}

export function buildConsolidatedFilename(records: AppRecord[]): string {
  const dateLabel = consolidatedDateLabel(records);
  return `RUTA CFT-ABL ${dateLabel}.xlsx`;
}
