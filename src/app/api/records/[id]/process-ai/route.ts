import { NextRequest, NextResponse } from "next/server";
import {
  findRecordById,
  incrementAttemptCount,
  markImageProcessed,
  saveExtraction,
} from "@/lib/repositories/records";
import { recordAttempt } from "@/lib/repositories/extraction-attempts";
import {
  extractWithVision,
  isVisionConfigured,
  resolveVisionProvider,
  shouldRequestBboxes,
  VisionProviderError,
} from "@/features/vision";
import { mergeExtractions } from "@/features/records/extraction-merge";
import { applyCatalogsToExtraction } from "@/features/catalogs/apply-to-extraction";
import { listActiveCatalogs } from "@/lib/repositories/catalogs";
import { findActiveBitacoraForDate } from "@/lib/repositories/bitacoras";
import {
  getRecordDayForBitacora,
  matchRecordToBitacora,
} from "@/features/bitacora/match";
import { buildBitacoraMetaBlock } from "@/features/bitacora/meta";
import {
  createEmptyExtraction,
  type Extraction,
} from "@/features/records/types";
import { mockExtractionFromImage } from "@/features/qwen/mock";

interface Body {
  /**
   * IDs de imágenes a procesar. Si está vacío o no se pasa, se procesan TODAS
   * las imágenes del registro en una sola llamada multimodal.
   */
  imageIds?: string[];
  /** Si true, descarta la extracción previa y arranca de cero. */
  reset?: boolean;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Body;

  const record = await findRecordById(id);
  if (!record) {
    return NextResponse.json(
      { message: "Registro no encontrado" },
      { status: 404 }
    );
  }

  // Seleccionamos las imágenes a procesar. Por defecto: TODAS.
  const targetImages =
    body.imageIds && body.imageIds.length > 0
      ? record.images.filter((i) => body.imageIds!.includes(i.id))
      : record.images;

  if (targetImages.length === 0) {
    return NextResponse.json(
      { message: "Sin imágenes para procesar" },
      { status: 400 }
    );
  }

  // Usamos las versiones procesadas (más livianas) cuando existan.
  const imageDataUrls = targetImages.map(
    (img) => img.processedUrl ?? img.url
  );

  const previous = body.reset ? undefined : record.extraction;

  const recordDay = getRecordDayForBitacora(record);
  const bitacora = await findActiveBitacoraForDate(recordDay);
  /** Pista al OCR: match con la extracción previa (antes de esta corrida). */
  const hintMatch =
    bitacora && record.extraction
      ? matchRecordToBitacora(record, bitacora)
      : null;
  const bitacoraHint = hintMatch?.suggested;

  let extraction: Extraction;
  let rawResponse = "";
  let model: string | undefined;
  let provider: "qwen" | "gemini" | "mock" = "mock";

  try {
    if (isVisionConfigured()) {
      const result = await extractWithVision({
        imageDataUrls,
        previousExtraction: previous,
        bitacoraHint,
      });
      extraction = result.extraction;
      rawResponse = result.rawResponse;
      model = result.model;
      provider = result.provider;
    } else {
      await new Promise((r) => setTimeout(r, 800));
      extraction = mockExtractionFromImage();
      rawResponse = JSON.stringify(extraction, null, 2);
      model = "mock";
      provider = "mock";
    }
  } catch (error) {
    const failingProvider =
      error instanceof VisionProviderError
        ? error.provider
        : (resolveVisionProvider() ?? "sin proveedor");
    const message =
      error instanceof Error ? error.message : "Error desconocido";
    return NextResponse.json(
      {
        message: `Error procesando con IA (${failingProvider}): ${message}`,
      },
      { status: 502 }
    );
  }

  const withBboxes = shouldRequestBboxes();

  const merged: Extraction = previous
    ? mergeExtractions(previous, extraction)
    : { ...createEmptyExtraction(), ...extraction };

  /** Re-match bitácora con el OCR recién mergeado (cada corrida de IA). */
  const freshMatch = bitacora
    ? matchRecordToBitacora({ ...record, extraction: merged }, bitacora)
    : null;

  merged._meta = {
    confidence: previous?._meta?.confidence ?? 0.85,
    processedImageIds: [
      ...(previous?._meta?.processedImageIds ?? []),
      ...targetImages.map((i) => i.id),
    ],
    processedAt: new Date().toISOString(),
    source: provider,
    lastRawResponse: rawResponse,
    lastModel: model,
    lastProvider: provider,
    lastWithBboxes: withBboxes,
    manualOverride: previous?._meta?.manualOverride,
    ...(freshMatch && bitacora
      ? {
          bitacora: buildBitacoraMetaBlock(
            bitacora,
            freshMatch.row,
            freshMatch.matchScore,
            merged
          ),
        }
      : {}),
  };

  const catalogs = await listActiveCatalogs();
  const normalized = applyCatalogsToExtraction(merged, catalogs);

  // Persistimos historial de attempts
  const attempt = await recordAttempt({
    recordId: id,
    extraction: normalized,
    rawResponse,
    provider,
    model,
    withBboxes,
    imageIds: targetImages.map((i) => i.id),
    reset: body.reset,
  });

  const updated = await saveExtraction(id, normalized, attempt.id);
  await incrementAttemptCount(id);
  for (const img of targetImages) {
    await markImageProcessed(id, img.id);
  }

  return NextResponse.json({ extraction: normalized, record: updated, attempt });
}
