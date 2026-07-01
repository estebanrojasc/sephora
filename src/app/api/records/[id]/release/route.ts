import { NextRequest, NextResponse } from "next/server";
import { releaseFromReview } from "@/lib/repositories/records";
import { mongoErrorResponse } from "@/lib/api-mongo-error";
import { resolveRecordImagesForClient } from "@/lib/storage/record-images";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const record = await releaseFromReview(id);
    if (!record) {
      return NextResponse.json(
        { message: "Registro no encontrado" },
        { status: 404 }
      );
    }
    return NextResponse.json(await resolveRecordImagesForClient(record));
  } catch (err) {
    return mongoErrorResponse(err, "api/records/[id]/release");
  }
}
