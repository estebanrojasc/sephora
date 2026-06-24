import { NextRequest, NextResponse } from "next/server";
import { listRecords } from "@/lib/repositories/records";
import type { RecordStatus } from "@/features/records/types";

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status") as
    | RecordStatus
    | "all"
    | null;
  const deviceId = request.nextUrl.searchParams.get("deviceId") ?? undefined;

  try {
    const records = await listRecords({
      status: status ?? "all",
      deviceId,
    });
    return NextResponse.json(records);
  } catch (err) {
    console.error("[api/records] GET", err);
    return NextResponse.json(
      {
        message:
          "No se pudo conectar a MongoDB. Verifica que esté corriendo en localhost:27017.",
      },
      { status: 503 }
    );
  }
}
