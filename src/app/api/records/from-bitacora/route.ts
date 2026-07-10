import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildAdminRecordFromBitacora } from "@/features/bitacora/build-extraction";
import {
  appendBitacoraRowRecordLink,
  findBitacoraById,
  removeBitacoraRowRecordLink,
} from "@/lib/repositories/bitacoras";
import {
  findRecordsByIds,
  insertRecordFromBitacora,
} from "@/lib/repositories/records";
import {
  getRowLinkedRecordIds,
  isConfirmedBitacoraRowLink,
  rowAllowsMultipleReviews,
} from "@/features/bitacora/row-links";

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

  const existingLinkIds = getRowLinkedRecordIds(row);
  if (existingLinkIds.length > 0) {
    const linkedRecords = await findRecordsByIds(existingLinkIds);
    const byId = new Map(linkedRecords.map((r) => [r.id, r]));
    const confirmed = linkedRecords.filter((r) =>
      isConfirmedBitacoraRowLink(r, row)
    );

    if (confirmed.length > 0 && !rowAllowsMultipleReviews(row)) {
      return NextResponse.json(
        {
          message: "Ya existe un registro vinculado a esta fila",
          recordId: confirmed[0]!.id,
        },
        { status: 409 }
      );
    }

    // Limpia vínculos obsoletos (mismo conductor/patente, otro recorrido).
    for (const id of existingLinkIds) {
      const rec = byId.get(id);
      if (!rec || !isConfirmedBitacoraRowLink(rec, row)) {
        await removeBitacoraRowRecordLink(bitacoraId, rowId, id);
      }
    }
  }

  if (
    row.rowType !== "manual" &&
    row.rowType !== "ruta" &&
    row.rowType !== "entrega_pendiente"
  ) {
    return NextResponse.json(
      {
        message:
          "Solo se pueden crear registros desde filas de ruta, manuales o entrega pendiente",
      },
      { status: 400 }
    );
  }

  if (row.rowType === "entrega_pendiente" && !row.scheduledDate?.trim()) {
    return NextResponse.json(
      { message: "La entrega pendiente debe tener fecha programada" },
      { status: 400 }
    );
  }

  const partial = buildAdminRecordFromBitacora(row, bitacora.date, bitacora);
  const record = await insertRecordFromBitacora(partial);
  await appendBitacoraRowRecordLink(bitacoraId, rowId, record.id);

  return NextResponse.json({ recordId: record.id, record }, { status: 201 });
}
