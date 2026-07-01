import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  findBitacoraById,
  updateBitacoraRowSettings,
} from "@/lib/repositories/bitacoras";
import { jsonNoStore } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const patchRowSchema = z.object({
  rowId: z.string().uuid(),
  allowsMultipleReviews: z.boolean(),
});

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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchRowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const bitacora = await findBitacoraById(id);
  if (!bitacora) {
    return NextResponse.json(
      { message: "Bitácora no encontrada" },
      { status: 404 }
    );
  }

  const row = bitacora.rows.find((r) => r.id === parsed.data.rowId);
  if (!row) {
    return NextResponse.json({ message: "Fila no encontrada" }, { status: 404 });
  }

  const updated = await updateBitacoraRowSettings(id, parsed.data.rowId, {
    allowsMultipleReviews: parsed.data.allowsMultipleReviews,
  });
  if (!updated) {
    return NextResponse.json(
      { message: "No se pudo actualizar la fila" },
      { status: 500 }
    );
  }

  return jsonNoStore(updated);
}
