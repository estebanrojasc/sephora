import { NextRequest, NextResponse } from "next/server";
import { findRecordById } from "@/lib/repositories/records";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await findRecordById(id);
  if (!record) {
    return NextResponse.json(
      { message: "Registro no encontrado" },
      { status: 404 }
    );
  }
  return NextResponse.json(record);
}
