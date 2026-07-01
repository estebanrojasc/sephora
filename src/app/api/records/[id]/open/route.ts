import { NextRequest, NextResponse } from "next/server";
import { openForReview } from "@/lib/repositories/records";
import { mongoErrorResponse } from "@/lib/api-mongo-error";

/** Marca el registro en revisión; respuesta liviana (sin imágenes ni extracción). */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const record = await openForReview(id);
    if (!record) {
      return NextResponse.json(
        { message: "Registro no encontrado" },
        { status: 404 }
      );
    }
    return NextResponse.json({
      id: record.id,
      status: record.status,
      previousStatus: record.previousStatus,
    });
  } catch (err) {
    return mongoErrorResponse(err, "api/records/[id]/open");
  }
}
