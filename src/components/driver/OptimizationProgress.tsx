import { Progress } from "@/components/ui/progress";
import { COPY } from "@/lib/constants";
import type { PipelineStep } from "@/features/image-pipeline/pipeline";

const stepLabels: Record<PipelineStep, string> = {
  original: "Generando versión original (admin)…",
  processed: "Generando versión liviana (IA)…",
  enhance: "Realzando contraste…",
  done: "Listo",
};

interface OptimizationProgressProps {
  step: PipelineStep | null;
  progress: number;
}

export function OptimizationProgress({
  step,
  progress,
}: OptimizationProgressProps) {
  return (
    <div className="space-y-3 rounded-lg border bg-muted/40 p-4">
      <p className="text-sm font-medium">{COPY.driver.optimizing}</p>
      {step && (
        <p className="text-xs text-muted-foreground">{stepLabels[step]}</p>
      )}
      <Progress value={progress} className="h-2" />
    </div>
  );
}
