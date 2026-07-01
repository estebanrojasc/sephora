import { NextRequest, NextResponse } from "next/server";
import { findRecordById } from "@/lib/repositories/records";
import { mongoErrorResponse } from "@/lib/api-mongo-error";
import { resolveRecordImagesForClient } from "@/lib/storage/record-images";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const record = await findRecordById(id);
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
