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
    <div className="animate-scale-in space-y-3 rounded-xl border-2 border-indigo-200/60 bg-indigo-50/60 p-4 shadow-sm dark:border-indigo-800/40 dark:bg-indigo-950/30">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50">
          <Sparkles className="size-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-indigo-700 dark:text-indigo-300">
            {COPY.driver.optimizing}
          </p>
          {step && (
            <p className="text-xs text-indigo-600/70 dark:text-indigo-400/70">
              {stepLabels[step]}
            </p>
          )}
        </div>
      </div>
      <Progress
        value={progress}
        className="h-2 bg-indigo-200/60 dark:bg-indigo-800/40 [&>div]:bg-indigo-500"
      />
    </div>
  );
}
