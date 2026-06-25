import { NextResponse } from "next/server";
import { listDistinctBitacoraDates } from "@/lib/repositories/bitacoras";

export async function GET() {
  const dates = await listDistinctBitacoraDates();
  return NextResponse.json(dates);
}
