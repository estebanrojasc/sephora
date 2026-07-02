import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import {
  buildRendicionExcelFilename,
  buildRendicionPayload,
} from "@/features/excel/build-rendicion";
import { renderRendicionExcel } from "@/features/excel/render";
import { findRecordsByIdsForExcel } from "@/lib/repositories/records";

export const runtime = "nodejs";

const TEMPLATE_PATH = path.join(
  process.cwd(),
  "templates",
  "RUTA CFT-ABL -2026.xlsx"
);

/** Cambia al tocar render.ts; sirve para confirmar que el deploy usa código nuevo. */
const RENDICION_RENDER_VERSION = "2026-07-02";

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await findRecordsByIdsForExcel([id]).then((r) => r[0] ?? null);

  if (!record) {
    return NextResponse.json(
      { message: "Registro no encontrado" },
      { status: 404 }
    );
  }

  if (!record.extraction) {
    return NextResponse.json(
      { message: "El registro no tiene extracción guardada" },
      { status: 409 }
    );
  }

  const template = await readFile(TEMPLATE_PATH);
  const payload = buildRendicionPayload(record);
  const rendered = renderRendicionExcel(template, payload);
  const filename = buildRendicionExcelFilename(record);
  const encodedFilename = encodeURIComponent(filename);

  return new Response(toArrayBuffer(rendered), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "no-store",
      "X-Rendicion-Render": RENDICION_RENDER_VERSION,
    },
  });
}
