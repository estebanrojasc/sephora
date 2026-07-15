import { NextRequest, NextResponse } from "next/server";
import { unlinkRecordFromBitacora } from "@/features/bitacora/unlink-record";
import { requireSession } from "@/lib/auth/guard";
import { mongoErrorResponse } from "@/lib/api-mongo-error";
import { resolveRecordImagesForClient } from "@/lib/storage/record-images";

/** Desvincula el registro de la bitácora (filas + meta), sin borrar el registro. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSession();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  try {
    const updated = await unlinkRecordFromBitacora(id);
    if (!updated) {
      return NextResponse.json(
        { message: "Registro no encontrado" },
        { status: 404 }
      );
    }
    const withUrls = await resolveRecordImagesForClient(updated);
    return NextResponse.json(withUrls);
  } catch (err) {
    return mongoErrorResponse(err, "api/records/[id]/bitacora-link DELETE");
  }
}
