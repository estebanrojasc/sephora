import { resizeImage } from "./pica";
import { compressImage } from "./compressor";
import { enhanceForOcr } from "./enhance";
import {
  PIPELINE_ORIGINAL_JPEG_QUALITY,
  PIPELINE_ORIGINAL_MAX_DIMENSION,
  PIPELINE_PROCESSED_JPEG_QUALITY,
  PIPELINE_PROCESSED_MAX_DIMENSION,
} from "@/lib/constants";

export type PipelineStep = "original" | "processed" | "enhance" | "done";

export type PipelineProgress = (step: PipelineStep, pct: number) => void;

export interface PipelineOptions {
  /**
   * Aplica realce de contraste (histogram stretch) a la versión PROCESADA.
   * Apagado por defecto: tiende a engrosar trazos manuscritos. Úsalo solo si
   * la imagen tiene iluminación muy dispareja.
   */
  enhance?: boolean;
}

export interface PipelineResult {
  /** Versión nítida para que el admin pueda hacer zoom y revisar. */
  originalBlob: Blob;
  originalDataUrl: string;
  /** Versión liviana enviada al modelo (Qwen). */
  processedBlob: Blob;
  processedDataUrl: string;
}

/**
 * Pipeline post-recorte:
 * 1) Genera versión ORIGINAL (alta resolución, JPEG 0.85) para revisión visual.
 * 2) Genera versión PROCESADA (resolución menor + compresión + opcional realce)
 *    optimizada para tokens de Qwen.
 */
export async function runPipeline(
  input: Blob,
  onProgress?: PipelineProgress,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const { enhance = false } = options;

  onProgress?.("original", 10);
  const resizedOriginal = await resizeImage(
    input,
    PIPELINE_ORIGINAL_MAX_DIMENSION
  );
  const originalBlob = await compressImage(
    resizedOriginal,
    PIPELINE_ORIGINAL_JPEG_QUALITY
  );
  onProgress?.("original", 100);

  onProgress?.("processed", 10);
  let processedSource = await resizeImage(
    input,
    PIPELINE_PROCESSED_MAX_DIMENSION
  );
  if (enhance) {
    onProgress?.("enhance", 50);
    processedSource = await enhanceForOcr(processedSource);
  }
  const processedBlob = await compressImage(
    processedSource,
    PIPELINE_PROCESSED_JPEG_QUALITY
  );
  onProgress?.("processed", 100);

  const [originalDataUrl, processedDataUrl] = await Promise.all([
    blobToDataUrl(originalBlob),
    blobToDataUrl(processedBlob),
  ]);

  onProgress?.("done", 100);

  return {
    originalBlob,
    originalDataUrl,
    processedBlob,
    processedDataUrl,
  };
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
