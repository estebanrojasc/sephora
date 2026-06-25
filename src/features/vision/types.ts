import type { Extraction } from "@/features/records/types";
import type { BitacoraSuggestedFields } from "@/features/bitacora/types";

export type VisionProvider = "qwen" | "gemini";

export interface VisionExtractOptions {
  /**
   * Imágenes a procesar en una sola llamada multimodal. La IA recibe todas y
   * devuelve UN solo JSON consolidado para todo el documento.
   *
   * Acepta también `imageDataUrl` (compat) para una sola página.
   */
  imageDataUrls: string[];
  previousExtraction?: Extraction;
  withBboxes: boolean;
  /** Pistas opcionales de la bitácora matinal del día. */
  bitacoraHint?: BitacoraSuggestedFields;
}

export interface VisionExtractResult {
  extraction: Extraction;
  rawResponse: string;
  model: string;
  provider: VisionProvider;
}
