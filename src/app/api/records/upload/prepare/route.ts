import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { PrepareDirectUploadPayload } from "@/features/records/types";
import { canAppendImagesToRecord } from "@/features/records/types";
import { findRecordById } from "@/lib/repositories/records";
import { requireSession } from "@/lib/auth/guard";
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
    let recordId = body.recordId?.trim() || randomUUID();
    let asAdmin = false;

    if (body.recordId?.trim()) {
      const existing = await findRecordById(body.recordId.trim());
      if (!existing) {
        return NextResponse.json(
          { message: "Registro no encontrado", code: "RECORD_NOT_FOUND" },
          { status: 404 }
        );
      }

      if (existing.deviceId !== body.deviceId) {
        const auth = await requireSession();
        if ("error" in auth) {
          return NextResponse.json(
            {
              message: "El registro no pertenece a este dispositivo",
              code: "DEVICE_MISMATCH",
            },
            { status: 403 }
          );
        }
        asAdmin = true;
      }

      if (!canAppendImagesToRecord(existing.status)) {
        return NextResponse.json(
          {
            message: `No se pueden agregar imágenes en estado «${existing.status}»`,
            code: "RECORD_NOT_APPENDABLE",
          },
          { status: 409 }
        );
      }
      recordId = existing.id;
    }

    const uploads = await prepareRecordImageUploads(recordId, body.images);
    return NextResponse.json({ recordId, uploads, asAdmin });
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
