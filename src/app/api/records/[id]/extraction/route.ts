import { NextRequest, NextResponse } from "next/server";
import {
  applyExtractionPatch,
  incrementAttemptCount,
  saveExtraction,
} from "@/lib/repositories/records";
import { recordAttempt } from "@/lib/repositories/extraction-attempts";
import { diffExtractions } from "@/features/records/extraction-diff";
import { applyCatalogsToExtraction } from "@/features/catalogs/apply-to-extraction";
import { rematchExtractionBitacora } from "@/features/bitacora/rematch-extraction";
import { listActiveCatalogs } from "@/lib/repositories/catalogs";
import type { UpdateExtractionPayload } from "@/features/records/types";
import { mongoErrorResponse } from "@/lib/api-mongo-error";
import { resolveRecordImagesForClient } from "@/lib/storage/record-images";

/**
 * Aplica un PATCH de extracción (correcciones manuales del admin). Cuando hay
 * cambios reales respecto a la extracción previa, crea un nuevo
 * `ExtractionAttempt` con `provider: "manual"` para mantener historial: queda
 * registrado qué entregó la IA y qué corrigió el revisor.
 *
 * Si cambia la fecha del documento, re-matchea la bitácora del nuevo día.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: UpdateExtractionPayload;
  try {
    body = (await request.json()) as UpdateExtractionPayload;
  } catch {
    return NextResponse.json(
      { message: "JSON inválido en el cuerpo" },
      { status: 400 }
    );
  }

  try {
    const result = await applyExtractionPatch(id, body);
    if (!result) {
      return NextResponse.json(
        { message: "Registro no encontrado" },
        { status: 404 }
      );
    }

    const catalogs = await listActiveCatalogs();
    const withCatalogs = applyCatalogsToExtraction(
      result.nextExtraction,
      catalogs
    );
    const nextExtraction = await rematchExtractionBitacora(
      result.record,
      withCatalogs,
      { syncRowLink: true }
    );

    const modifiedFields = diffExtractions(
      result.previousExtraction,
      nextExtraction
    );

    // Si no cambió nada, devolvemos el record tal cual (sin generar attempt).
    if (modifiedFields.length === 0) {
      return NextResponse.json(
        await resolveRecordImagesForClient({
          ...result.record,
          extraction: nextExtraction,
        })
      );
    }

    const attempt = await recordAttempt({
      recordId: id,
      extraction: nextExtraction,
      provider: "manual",
      withBboxes: false,
      imageIds: [],
      modifiedFields,
      basedOnAttemptId: result.record.currentAttemptId,
    });

    const updated = await saveExtraction(id, nextExtraction, attempt.id);
    await incrementAttemptCount(id);

    const recordOut = updated ?? { ...result.record, extraction: nextExtraction };
    return NextResponse.json(await resolveRecordImagesForClient(recordOut));
  } catch (err) {
    return mongoErrorResponse(err, "api/records/[id]/extraction");
  }
}
