import { NextRequest, NextResponse } from "next/server";
import { setStatus } from "@/lib/repositories/records";
import type { RecordStatus } from "@/features/records/types";
import { mongoErrorResponse } from "@/lib/api-mongo-error";
import { resolveRecordImagesForClient } from "@/lib/storage/record-images";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = (await request.json()) as {
      status: RecordStatus;
      errorComment?: string;
    };
    const record = await setStatus(id, body.status, body.errorComment);
    if (!record) {
      return NextResponse.json(
        { message: "Registro no encontrado" },
        { status: 404 }
      );
    }
    return NextResponse.json(await resolveRecordImagesForClient(record));
  } catch (err) {
    return mongoErrorResponse(err, "api/records/[id]/status");
  }
}
