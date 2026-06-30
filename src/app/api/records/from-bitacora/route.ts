import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildAdminRecordFromBitacora } from "@/features/bitacora/build-extraction";
import {
  findBitacoraById,
  updateBitacoraRowLink,
} from "@/lib/repositories/bitacoras";
import { insertRecordFromBitacora } from "@/lib/repositories/records";

const bodySchema = z.object({
  bitacoraId: z.string().uuid(),
  rowId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { bitacoraId, rowId } = parsed.data;
  const bitacora = await findBitacoraById(bitacoraId);
  if (!bitacora) {
    return NextResponse.json({ message: "Bitácora no encontrada" }, { status: 404 });
  }

  const row = bitacora.rows.find((r) => r.id === rowId);
  if (!row) {
    return NextResponse.json({ message: "Fila no encontrada" }, { status: 404 });
  }

  if (row.linkedRecordId) {
    return NextResponse.json(
      { message: "Ya existe un registro vinculado a esta fila", recordId: row.linkedRecordId },
      { status: 409 }
    );
  }

  if (row.rowType !== "manual" && row.rowType !== "ruta") {
    return NextResponse.json(
      { message: "Solo se pueden crear registros desde filas de ruta o manuales" },
      { status: 400 }
    );
  }

  const partial = buildAdminRecordFromBitacora(row, bitacora.date, bitacora);
  const record = await insertRecordFromBitacora(partial);
  await updateBitacoraRowLink(bitacoraId, rowId, record.id);

  return NextResponse.json({ recordId: record.id, record }, { status: 201 });
}
