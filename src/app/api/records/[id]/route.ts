import { NextRequest, NextResponse } from "next/server";
import {
  collectRecordGcsKeys,
  deleteRecord,
  findRecordByIdForDetail,
} from "@/lib/repositories/records";
import { requireSession } from "@/lib/auth/guard";
import { mongoErrorResponse } from "@/lib/api-mongo-error";
import { resolveRecordImagesForClient } from "@/lib/storage/record-images";
import { deleteObjects } from "@/lib/storage/gcs";
import { isGcsConfigured } from "@/lib/storage/gcs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const record = await findRecordByIdForDetail(id);
    if (!record) {
      return NextResponse.json(
        { message: "Registro no encontrado" },
        { status: 404 }
      );
    }
    const withUrls = await resolveRecordImagesForClient(record);
    return NextResponse.json(withUrls);
  } catch (err) {
    return mongoErrorResponse(err, "api/records/[id]");
  }
}

/** Elimina el registro y, si hay GCS, los objetos asociados. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  try {
    const deleted = await deleteRecord(id);
    if (!deleted) {
      return NextResponse.json(
        { message: "Registro no encontrado" },
        { status: 404 }
      );
    }

    if (isGcsConfigured()) {
      const keys = collectRecordGcsKeys(deleted);
      if (keys.length > 0) {
        await deleteObjects(keys);
      }
    }

    return NextResponse.json({ ok: true, id });
  } catch (err) {
    return mongoErrorResponse(err, "api/records/[id] DELETE");
  }
}
