import { NextRequest, NextResponse } from "next/server";
import { setStatus } from "@/lib/repositories/records";
import type { RecordStatus } from "@/features/records/types";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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
  return NextResponse.json(record);
}
