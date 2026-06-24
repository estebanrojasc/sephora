import type { Extraction } from "@/features/records/types";

export type ExtractionAttemptProvider =
  | "qwen"
  | "gemini"
  | "mock"
  | "manual";

export interface ExtractionAttempt {
  id: string;
  recordId: string;
  /** Si es false, se sustituyó por uno nuevo (queda en historial). */
  isActive: boolean;
  extraction: Extraction;
  rawResponse?: string;
  provider: ExtractionAttemptProvider;
  model?: string;
  withBboxes: boolean;
  /** Imágenes que se enviaron en este attempt. */
  imageIds: string[];
  /** Si vino de un "reset" (reemplazó al anterior por completo). */
  reset?: boolean;
  /**
   * Claves de la extracción que fueron modificadas en este attempt respecto al
   * anterior. Solo se rellena para attempts de tipo `manual` (el admin corrigió
   * datos a mano tras la IA).
   */
  modifiedFields?: string[];
  /** ID del attempt previo que este reemplazó (si aplica). */
  basedOnAttemptId?: string;
  createdAt: string;
}
