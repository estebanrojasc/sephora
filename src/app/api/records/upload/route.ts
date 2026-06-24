import { NextRequest, NextResponse } from "next/server";
import { insertRecord } from "@/lib/repositories/records";
import type { UploadPayload } from "@/features/records/types";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as UploadPayload;
  try {
    const record = await insertRecord(body);
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    console.error("[api/records/upload]", err);
    return NextResponse.json(
      { message: "Error al guardar el registro" },
      { status: 500 }
    );
  }
}
