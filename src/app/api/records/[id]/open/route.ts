import { NextRequest, NextResponse } from "next/server";
import { openForReview } from "@/lib/repositories/records";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const record = await openForReview(id);
  if (!record) {
    return NextResponse.json(
      { message: "Registro no encontrado" },
      { status: 404 }
    );
  }
  return NextResponse.json(record);
}
