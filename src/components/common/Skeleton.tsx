import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className, style }: SkeletonProps) {
  return <div className={cn("skeleton rounded-md bg-muted", className)} style={style} />;
}

export function SkeletonLine({ width = "100%", className }: { width?: string; className?: string }) {
  return <Skeleton className={cn("h-4 rounded", className)} style={{ width }} />;
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={i === lines - 1 ? "60%" : "100%"} />
      ))}
    </div>
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-2">
          <SkeletonLine width="40%" />
          <SkeletonLine width="70%" />
          <SkeletonLine width="50%" />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-10" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 6, className }: { rows?: number; cols?: number; className?: string }) {
  return (
    <div className={cn("rounded-xl border", className)}>
      <div className="flex items-center gap-4 border-b bg-muted/30 px-4 py-2.5">
        {Array.from({ length: cols }).map((_, i) => <SkeletonLine key={i} width="35%" className="h-3" />)}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={cn("flex items-center gap-4 px-4 py-3", i < rows - 1 && "border-b")}>
          {Array.from({ length: cols }).map((_, j) => (
            <SkeletonLine key={j} width={j === 0 ? "25%" : `${50 + Math.floor(Math.random() * 40)}%`} className="h-3" />
          ))}
        </div>
      ))}
    </div>
  );
}
