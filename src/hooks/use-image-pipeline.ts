"use client";

import { useCallback, useState } from "react";
import {
  runPipeline,
  type PipelineOptions,
  type PipelineResult,
  type PipelineStep,
} from "@/features/image-pipeline/pipeline";

export function useImagePipeline() {
  const [step, setStep] = useState<PipelineStep | null>(null);
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processBlob = useCallback(
    async (blob: Blob, options?: PipelineOptions): Promise<PipelineResult> => {
      setIsProcessing(true);
      setError(null);
      setProgress(0);

      try {
        const result = await runPipeline(
          blob,
          (s, pct) => {
            setStep(s);
            setProgress(pct);
          },
          options
        );
        return result;
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Error al optimizar la imagen";
        setError(message);
        throw e;
      } finally {
        setIsProcessing(false);
        setStep(null);
      }
    },
    []
  );

  return { processBlob, step, progress, isProcessing, error };
}
