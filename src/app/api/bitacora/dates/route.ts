import { listDistinctBitacoraDates } from "@/lib/repositories/bitacoras";
import { jsonNoStore } from "@/lib/api-response";
import { mongoErrorResponse } from "@/lib/api-mongo-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 10;

export async function GET() {
  try {
    const dates = await listDistinctBitacoraDates();
    return jsonNoStore(dates);
  } catch (err) {
    return mongoErrorResponse(err, "api/bitacora/dates");
  }
}
