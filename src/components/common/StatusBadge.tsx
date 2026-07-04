"use client";

import { Badge } from "@/components/ui/badge";
import { getStatusConfig } from "@/features/records/status";
import type { RecordStatus } from "@/features/records/types";
import { cn } from "@/lib/utils";

const toneClasses = {
  info: "border-blue-300/60 bg-blue-50 text-blue-700 dark:border-blue-700/60 dark:bg-blue-950/60 dark:text-blue-200",
  warning:
    "border-amber-300/60 bg-amber-50 text-amber-800 dark:border-amber-700/60 dark:bg-amber-950/60 dark:text-amber-200",
  danger:
    "border-red-300/60 bg-red-50 text-red-700 dark:border-red-700/60 dark:bg-red-950/60 dark:text-red-200",
  success:
    "border-emerald-300/60 bg-emerald-50 text-emerald-700 dark:border-emerald-700/60 dark:bg-emerald-950/60 dark:text-emerald-200",
  neutral:
    "border-slate-300/60 bg-slate-50 text-slate-700 dark:border-slate-600/60 dark:bg-slate-800/60 dark:text-slate-200",
};

const dotClasses = {
  info: "bg-blue-500 shadow-[0_0_6px_rgb(59_130_246/0.5)]",
  warning: "bg-amber-500 shadow-[0_0_6px_rgb(245_158_11/0.5)]",
  danger: "bg-red-500 shadow-[0_0_6px_rgb(239_68_68/0.5)]",
  success: "bg-emerald-500 shadow-[0_0_6px_rgb(16_185_129/0.5)]",
  neutral: "bg-slate-400",
};

interface StatusBadgeProps {
  status: RecordStatus;
  className?: string;
  showIcon?: boolean;
  /** Si true, muestra un punto coloreado en lugar del ícono. */
  showDot?: boolean;
}

export function StatusBadge({
  status,
  className,
  showIcon = true,
  showDot = false,
}: StatusBadgeProps) {
  const config = getStatusConfig(status);
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1.5 rounded-full border px-2.5 py-0.5 font-medium transition-colors",
        toneClasses[config.tone],
        className
      )}
    >
      {showDot && (
        <span
          className={cn(
            "size-1.5 rounded-full animate-pulse-soft",
            dotClasses[config.tone]
          )}
        />
      )}
      {showIcon && !showDot && <Icon className="size-3" />}
      {config.label}
    </Badge>
  );
}
