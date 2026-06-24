import { NextRequest, NextResponse } from "next/server";
import {
  applyExtractionPatch,
  incrementAttemptCount,
  saveExtraction,
} from "@/lib/repositories/records";
import { recordAttempt } from "@/lib/repositories/extraction-attempts";
import { diffExtractions } from "@/features/records/extraction-diff";
import type { UpdateExtractionPayload } from "@/features/records/types";

/**
 * Aplica un PATCH de extracción (correcciones manuales del admin). Cuando hay
 * cambios reales respecto a la extracción previa, crea un nuevo
 * `ExtractionAttempt` con `provider: "manual"` para mantener historial: queda
 * registrado qué entregó la IA y qué corrigió el revisor.
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

  const result = await applyExtractionPatch(id, body);
  if (!result) {
    return NextResponse.json(
      { message: "Registro no encontrado" },
      { status: 404 }
    );
  }

  const modifiedFields = diffExtractions(
    result.previousExtraction,
    result.nextExtraction
  );

  // Si no cambió nada, devolvemos el record tal cual (sin generar attempt).
  if (modifiedFields.length === 0) {
    return NextResponse.json(result.record);
  }

  const attempt = await recordAttempt({
    recordId: id,
    extraction: result.nextExtraction,
    provider: "manual",
    withBboxes: false,
    imageIds: [],
    modifiedFields,
    basedOnAttemptId: result.record.currentAttemptId,
  });

  const updated = await saveExtraction(id, result.nextExtraction, attempt.id);
  await incrementAttemptCount(id);

  return NextResponse.json(updated ?? result.record);
}
