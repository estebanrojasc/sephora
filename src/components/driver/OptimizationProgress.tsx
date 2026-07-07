import { Progress } from "@/components/ui/progress";
import { Sparkles } from "lucide-react";
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
    <div className="animate-scale-in space-y-3 rounded-xl border-2 border-primary/30 bg-primary-lighter/50 p-4 shadow-sm dark:border-primary/20 dark:bg-primary-darker/20">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-full bg-primary/20">
          <Sparkles className="size-4 text-primary-dark dark:text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-primary-dark dark:text-primary">
            {COPY.driver.optimizing}
          </p>
          {step && (
            <p className="text-xs text-primary-dark/70 dark:text-primary/70">
              {stepLabels[step]}
            </p>
          )}
        </div>
      </div>
      <Progress
        value={progress}
        className="h-2 bg-primary/20 dark:bg-primary/10 [&>div]:bg-primary"
      />
    </div>
  );
}
