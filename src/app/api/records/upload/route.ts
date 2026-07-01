import { NextRequest, NextResponse } from "next/server";
import { insertRecord } from "@/lib/repositories/records";
import type { UploadPayload } from "@/features/records/types";

export async function POST(request: NextRequest) {
  let body: UploadPayload;
  try {
    body = (await request.json()) as UploadPayload;
  } catch {
    return NextResponse.json({ message: "JSON inválido" }, { status: 400 });
  }

  try {
    const record = await insertRecord(body);
    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    console.error("[api/records/upload]", err);
    const message =
      err instanceof Error ? err.message : "Error al guardar el registro";
    return NextResponse.json({ message }, { status: 500 });
  }
}
