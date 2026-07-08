import { NextRequest, NextResponse } from "next/server";
import { insertRecord, appendImagesToRecord } from "@/lib/repositories/records";
import type { UploadPayload } from "@/features/records/types";
import { shouldUseGcsForUpload } from "@/lib/storage/record-images";

export async function POST(request: NextRequest) {
  if (shouldUseGcsForUpload()) {
    return NextResponse.json(
      {
        message:
          "Con GCS activo la subida es directa al bucket: /api/records/upload/prepare y /complete",
        code: "USE_DIRECT_UPLOAD",
      },
      { status: 410 }
    );
  }

  let body: UploadPayload;
  try {
    body = (await request.json()) as UploadPayload;
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  try {
    const record = body.recordId
      ? await appendImagesToRecord(body.recordId, body)
      : await insertRecord(body);
    return NextResponse.json(record, {
      status: body.recordId ? 200 : 201,
    });
  } catch (err) {
    console.error("[api/records/upload]", err);
    if (err instanceof Error) {
      if (err.message === "RECORD_NOT_FOUND") {
        return NextResponse.json(
          { message: "Registro no encontrado" },
          { status: 404 }
        );
      }
      if (err.message === "DEVICE_MISMATCH") {
        return NextResponse.json(
          { message: "El registro no pertenece a este dispositivo" },
          { status: 403 }
        );
      }
      if (err.message === "RECORD_NOT_APPENDABLE") {
        return NextResponse.json(
          { message: "No se pueden agregar imágenes en el estado actual" },
          { status: 409 }
        );
      }
    }
    const message =
      err instanceof Error ? err.message : "Error al guardar el registro";
    return NextResponse.json({ message }, { status: 500 });
  }
}
