"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BitacoraStep {
  id: number;
  label: string;
  description: string;
}

export const BITACORA_STEPS: BitacoraStep[] = [
  {
    id: 1,
    label: "Pegar",
    description: "Copia la tabla desde Excel y pégala aquí",
  },
  {
    id: 2,
    label: "Revisar",
    description: "Confirma fecha, filas y clasificación",
  },
  {
    id: 3,
    label: "Guardar",
    description: "Publica la versión del día",
  },
];

interface BitacoraStepperProps {
  currentStep: number;
  className?: string;
}

export function BitacoraStepper({ currentStep, className }: BitacoraStepperProps) {
  return (
    <nav aria-label="Pasos de carga" className={cn("w-full", className)}>
      <ol className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {BITACORA_STEPS.map((step, index) => {
          const done = currentStep > step.id;
          const active = currentStep === step.id;
          return (
            <li
              key={step.id}
              className={cn(
                "flex flex-1 items-start gap-3 sm:flex-col sm:items-center sm:text-center",
                index < BITACORA_STEPS.length - 1 && "sm:relative"
              )}
            >
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors",
                  done &&
                    "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500",
                  active &&
                    "border-indigo-600 bg-indigo-50 text-indigo-700 dark:border-indigo-400 dark:bg-indigo-950 dark:text-indigo-200",
                  !done &&
                    !active &&
                    "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {done ? <Check className="size-4" /> : step.id}
              </div>
              <div className="min-w-0 pt-0.5 sm:pt-2">
                <p
                  className={cn(
                    "text-sm font-medium",
                    active ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
