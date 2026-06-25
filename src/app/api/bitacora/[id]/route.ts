import { NextResponse } from "next/server";
import { findBitacoraById } from "@/lib/repositories/bitacoras";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bitacora = await findBitacoraById(id);
  if (!bitacora) {
    return NextResponse.json({ message: "Bitácora no encontrada" }, { status: 404 });
  }
  return NextResponse.json(bitacora);
}
