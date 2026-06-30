import { listDistinctBitacoraDates } from "@/lib/repositories/bitacoras";
import { jsonNoStore } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const dates = await listDistinctBitacoraDates();
  return jsonNoStore(dates);
}
