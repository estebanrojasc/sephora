import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-8 py-12 text-center transition-colors hover:border-muted-foreground/20",
        className
      )}
    >
      <div className="flex size-16 items-center justify-center rounded-2xl bg-muted/80 shadow-inner">
        <Icon className="size-7 text-muted-foreground/70" />
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-semibold">{title}</p>
        {description && (
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="pt-2 animate-fade-in-up">{action}</div>
      )}
    </div>
  );
}
