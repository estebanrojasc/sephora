import { NextRequest, NextResponse } from "next/server";
import type { CompleteDirectUploadPayload } from "@/features/records/types";
import { completeDirectRecordUpload } from "@/lib/repositories/records";
import { shouldUseGcsForUpload } from "@/lib/storage/record-images";

function validateCompleteBody(
  body: CompleteDirectUploadPayload
): string | null {
  if (!body.recordId?.trim()) return "recordId requerido";
  if (!body.deviceId?.trim()) return "deviceId requerido";
  if (!body.driverId?.trim()) return "driverId requerido";
  if (!body.driverName?.trim()) return "driverName requerido";
  if (!Array.isArray(body.images) || body.images.length === 0) {
    return "Se requiere al menos una imagen";
  }
  for (const img of body.images) {
    if (!img.id?.trim()) return "id requerido por imagen";
    if (!img.url?.trim()) return "url requerida por imagen";
    if (!img.name?.trim()) return "name requerido por imagen";
  }
  return null;
}

export async function POST(request: NextRequest) {
  if (!shouldUseGcsForUpload()) {
    return NextResponse.json(
      { message: "GCS no configurado", code: "GCS_NOT_CONFIGURED" },
      { status: 503 }
    );
  }

  let body: CompleteDirectUploadPayload;
  try {
    body = (await request.json()) as CompleteDirectUploadPayload;
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  const validationError = validateCompleteBody(body);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  try {
    const record = await completeDirectRecordUpload(body);
    const created = record.images.length === body.images.length;
    return NextResponse.json(record, { status: created ? 201 : 200 });
  } catch (err) {
    console.error("[api/records/upload/complete]", err);
    if (err instanceof Error) {
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
    const missingObjects = message.includes("Faltan objetos en GCS");
    return NextResponse.json(
      {
        message: missingObjects
          ? "Las imágenes no llegaron al bucket. Revisa CORS en GCS y vuelve a enviar."
          : message,
        code: missingObjects ? "GCS_OBJECTS_MISSING" : undefined,
      },
      { status: missingObjects ? 400 : 500 }
    );
  }
}
