import { NextResponse } from "next/server";
import { findBitacoraById } from "@/lib/repositories/bitacoras";
import { jsonNoStore } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bitacora = await findBitacoraById(id);
  if (!bitacora) {
    return NextResponse.json(
      { message: "Bitácora no encontrada" },
      { status: 404 }
    );
  }
  return jsonNoStore(bitacora);
}
