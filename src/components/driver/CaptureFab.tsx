"use client";

import Link from "next/link";
import { Camera } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { COPY } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function CaptureFab() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/80 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <Link
        href="/driver/capture"
        className={cn(
          buttonVariants({ size: "lg" }),
          "h-14 w-full gap-2.5 rounded-2xl text-base font-semibold shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30 active:scale-[0.98]"
        )}
      >
        <Camera className="size-5" />
        {COPY.driver.newRecord}
      </Link>
    </div>
  );
}
