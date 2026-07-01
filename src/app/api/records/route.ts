import { NextRequest } from "next/server";
import { listRecords } from "@/lib/repositories/records";
import type { RecordStatus } from "@/features/records/types";
import { jsonNoStore } from "@/lib/api-response";
import { mongoErrorResponse } from "@/lib/api-mongo-error";

export const dynamic = "force-dynamic";

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
    return jsonNoStore(records);
  } catch (err) {
    return mongoErrorResponse(err, "api/records");
  }
}
