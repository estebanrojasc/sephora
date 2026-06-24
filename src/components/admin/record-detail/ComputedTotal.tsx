"use client";

import { Sigma, Check, AlertTriangle } from "lucide-react";
import { formatCLP, parseNumber } from "@/lib/parse-number";
import { cn } from "@/lib/utils";

interface ComputedTotalProps {
  /** Strings con cada valor sumable (ej. "$ 12.000"). */
  values: (string | undefined | null)[];
  /** Valor extraído del documento al que se compara. */
  extractedValue?: string;
  className?: string;
  /** Tolerancia absoluta para considerar que coincide. Default 1. */
  tolerance?: number;
}

export function ComputedTotal({
  values,
  extractedValue,
  className,
  tolerance = 1,
}: ComputedTotalProps) {
  const numbers = values
    .map((v) => parseNumber(v ?? ""))
    .filter((n): n is number => n !== null);

  if (numbers.length === 0) return null;

  const sum = numbers.reduce((acc, n) => acc + n, 0);
  const extracted = parseNumber(extractedValue ?? "");
  const matches =
    extracted !== null && Math.abs(extracted - sum) <= tolerance;

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border border-dashed border-sky-400/60 bg-sky-50 px-2 py-1.5 text-xs dark:border-sky-700 dark:bg-sky-950/40",
        className
      )}
    >
      <Sigma className="size-3.5 text-sky-700 dark:text-sky-300" />
      <span className="font-medium text-sky-900 dark:text-sky-200">
        Suma calculada
      </span>
      <span className="ml-auto font-mono tabular-nums text-sky-950 dark:text-sky-100">
        {formatCLP(sum)}
      </span>
      {extracted !== null && (
        <span
          className={cn(
            "ml-1 inline-flex items-center gap-0.5 rounded-sm px-1 py-0.5 text-[10px] font-semibold",
            matches
              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
              : "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
          )}
        >
          {matches ? (
            <Check className="size-3" />
          ) : (
            <AlertTriangle className="size-3" />
          )}
          {matches ? "coincide" : `Δ ${formatCLP(Math.abs(extracted - sum))}`}
        </span>
      )}
    </div>
  );
}
