import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { PrepareDirectUploadPayload } from "@/features/records/types";
import { getGcsCredentialsError } from "@/lib/storage/config";
import {
  prepareRecordImageUploads,
  shouldUseGcsForUpload,
} from "@/lib/storage/record-images";

function validatePrepareBody(
  body: PrepareDirectUploadPayload
): string | null {
  if (!body.deviceId?.trim()) return "deviceId requerido";
  if (!body.driverId?.trim()) return "driverId requerido";
  if (!body.driverName?.trim()) return "driverName requerido";
  if (!Array.isArray(body.images) || body.images.length === 0) {
    return "Se requiere al menos una imagen";
  }
  for (const img of body.images) {
    if (!img.originalContentType?.trim()) {
      return "originalContentType requerido por imagen";
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  if (!shouldUseGcsForUpload()) {
    const credError = getGcsCredentialsError();
    return NextResponse.json(
      {
        message: credError ?? "GCS no configurado",
        code: "GCS_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  let body: PrepareDirectUploadPayload;
  try {
    body = (await request.json()) as PrepareDirectUploadPayload;
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  const validationError = validatePrepareBody(body);
  if (validationError) {
    return NextResponse.json({ message: validationError }, { status: 400 });
  }

  try {
    const recordId = randomUUID();
    const uploads = await prepareRecordImageUploads(recordId, body.images);
    return NextResponse.json({ recordId, uploads });
  } catch (err) {
    console.error("[api/records/upload/prepare]", err);
    const message =
      err instanceof Error ? err.message : "Error al preparar la subida";
    const isAuth =
      message.includes("oauth2") ||
      message.includes("Premature close") ||
      message.includes("private_key");
    return NextResponse.json(
      {
        message: isAuth
          ? "No se pudo autenticar con Google Cloud. Revisa GCS_PRIVATE_KEY o GCS_SERVICE_ACCOUNT_JSON en Railway."
          : message,
        code: isAuth ? "GCS_AUTH_FAILED" : undefined,
      },
      { status: isAuth ? 503 : 500 }
    );
  }
}
