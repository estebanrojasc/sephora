import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { buildAdminRecordFromBitacora } from "@/features/bitacora/build-extraction";
import {
  bitacoraRowNeedsOwnRecord,
  collectBitacoraRowRecordLinks,
  getRowLinkedRecordIds,
  isConfirmedBitacoraRowLink,
  rowAllowsMultipleReviews,
} from "@/features/bitacora/row-links";
import { bitacoraRecorridoCanonical } from "@/features/bitacora/meta";
import {
  appendBitacoraRowRecordLink,
  findBitacoraById,
  removeBitacoraRowRecordLink,
} from "@/lib/repositories/bitacoras";
import {
  findRecordsByIds,
  insertRecordFromBitacora,
  listRecords,
} from "@/lib/repositories/records";

const bodySchema = z.object({
  bitacoraId: z.string().uuid(),
});

/**
 * Crea de una vez todos los registros faltantes (filas sin vínculo confirmado).
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const { bitacoraId } = parsed.data;
  const bitacora = await findBitacoraById(bitacoraId);
  if (!bitacora) {
    return NextResponse.json({ message: "Bitácora no encontrada" }, { status: 404 });
  }

  const allRecords = await listRecords({ status: "all" });
  const links = collectBitacoraRowRecordLinks(bitacora, allRecords);
  const missing = bitacora.rows.filter((row) =>
    bitacoraRowNeedsOwnRecord(row, links.get(row.id) ?? [])
  );

  if (missing.length === 0) {
    return NextResponse.json({ created: 0, recordIds: [], failures: [] });
  }

  const recordIds: string[] = [];
  const failures: { recorrido: string; message: string }[] = [];

  for (const row of missing) {
    const label = bitacoraRecorridoCanonical(row) || row.conductor || row.id;
    try {
      const existingLinkIds = getRowLinkedRecordIds(row);
      if (existingLinkIds.length > 0) {
        const linkedRecords = await findRecordsByIds(existingLinkIds);
        const byId = new Map(linkedRecords.map((r) => [r.id, r]));
        const confirmed = linkedRecords.filter((r) =>
          isConfirmedBitacoraRowLink(r, row)
        );
        if (confirmed.length > 0 && !rowAllowsMultipleReviews(row)) {
          failures.push({
            recorrido: label,
            message: "Ya existe un registro vinculado",
          });
          continue;
        }
        for (const id of existingLinkIds) {
          const rec = byId.get(id);
          if (!rec || !isConfirmedBitacoraRowLink(rec, row)) {
            await removeBitacoraRowRecordLink(bitacoraId, row.id, id);
          }
        }
      }

      const partial = buildAdminRecordFromBitacora(row, bitacora.date, bitacora);
      const record = await insertRecordFromBitacora(partial);
      await appendBitacoraRowRecordLink(bitacoraId, row.id, record.id);
      recordIds.push(record.id);
    } catch (e) {
      failures.push({
        recorrido: label,
        message: e instanceof Error ? e.message : "Error al crear",
      });
    }
  }

  return NextResponse.json(
    {
      created: recordIds.length,
      recordIds,
      failures,
    },
    { status: recordIds.length > 0 ? 201 : 200 }
  );
}
