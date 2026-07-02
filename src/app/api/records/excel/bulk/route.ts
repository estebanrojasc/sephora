import { NextRequest, NextResponse } from "next/server";
import {
  buildConsolidatedFilename,
  buildConsolidatedWorkbook,
} from "@/features/excel/build-consolidated";
import { loadRendicionTemplate } from "@/features/excel/template";
import { findRecordsByIdsForExcel } from "@/lib/repositories/records";

export const runtime = "nodejs";

const RENDICION_RENDER_VERSION = "2026-07-02-bulk";

const MAX_RECORDS = 50;

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

export async function POST(request: NextRequest) {
  let body: { recordIds?: string[] };
  try {
    body = (await request.json()) as { recordIds?: string[] };
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  const recordIds = body.recordIds?.filter(Boolean) ?? [];
  if (recordIds.length === 0) {
    return NextResponse.json(
      { message: "Debe seleccionar al menos un registro" },
      { status: 400 }
    );
  }

  if (recordIds.length > MAX_RECORDS) {
    return NextResponse.json(
      {
        message: `Máximo ${MAX_RECORDS} registros por exportación consolidada`,
      },
      { status: 400 }
    );
  }

  const records = await findRecordsByIdsForExcel(recordIds);
  if (records.length === 0) {
    return NextResponse.json(
      { message: "No se encontraron registros" },
      { status: 404 }
    );
  }

  const missingExtraction = records.filter((r) => !r.extraction);
  if (missingExtraction.length > 0) {
    return NextResponse.json(
      {
        message: `${missingExtraction.length} registro(s) no tienen extracción guardada`,
      },
      { status: 409 }
    );
  }

  let template: Uint8Array;
  try {
    template = loadRendicionTemplate();
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "Plantilla Excel no disponible",
      },
      { status: 500 }
    );
  }

  const rendered = buildConsolidatedWorkbook(template, records);
  const filename = buildConsolidatedFilename(records);
  const encodedFilename = encodeURIComponent(filename);

  if (rendered.byteLength < 10_000) {
    return NextResponse.json(
      { message: "El Excel generado está incompleto (archivo demasiado pequeño)" },
      { status: 500 }
    );
  }

  return new Response(toArrayBuffer(rendered), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "no-store",
      "X-Rendicion-Render": RENDICION_RENDER_VERSION,
      "X-Excel-Bytes": String(rendered.byteLength),
    },
  });
}
