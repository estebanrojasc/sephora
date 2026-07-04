"use client";

import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ImageWithZoom } from "@/components/common/ImageWithZoom";
import type { Bbox, RecordImage } from "@/features/records/types";
import type {
  BboxCalibration,
  BboxFormat,
  BboxOverlay,
} from "@/features/records/overlays";
import { cn } from "@/lib/utils";
import { useIsDesktop } from "@/hooks/use-media-query";

interface ImageGalleryProps {
  images: RecordImage[];
  selectedId: string;
  onSelect: (id: string) => void;
  processedIds?: Set<string>;
  highlightedBbox?: Bbox | null;
  overlays?: BboxOverlay[];
  calibration?: BboxCalibration;
  onMetricsChange?: (info: {
    detectedFormat: BboxFormat;
    naturalWidth: number;
    naturalHeight: number;
  }) => void;
  drawBboxMode?: boolean;
  onBboxDrawn?: (bbox: Bbox) => void;
  onCancelDraw?: () => void;
}

export function ImageGallery({
  images,
  selectedId,
  onSelect,
  processedIds,
  highlightedBbox,
  overlays,
  calibration,
  onMetricsChange,
  drawBboxMode,
  onBboxDrawn,
  onCancelDraw,
}: ImageGalleryProps) {
  const isDesktop = useIsDesktop();
  const selectedIndex = Math.max(
    0,
    images.findIndex((i) => i.id === selectedId)
  );
  const selected = images[selectedIndex] ?? images[0];

  if (!selected) {
    return (
      <p className="text-sm text-muted-foreground">
        Sin imágenes en este registro.
      </p>
    );
  }

  if (!isDesktop) {
    return (
      <div className="space-y-3">
        <div className="overflow-hidden rounded-xl border bg-muted/20 shadow-sm">
          <ImageWithZoom
            src={selected.url}
            alt={`Documento ${selectedIndex + 1}`}
            highlightedBbox={highlightedBbox}
            overlays={overlays}
            calibration={calibration}
            onMetricsChange={onMetricsChange}
            drawBboxMode={drawBboxMode}
            onBboxDrawn={onBboxDrawn}
            onCancelDraw={onCancelDraw}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            disabled={selectedIndex === 0}
            onClick={() => onSelect(images[selectedIndex - 1].id)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium tabular-nums">
              {selectedIndex + 1}
            </span>
            <span className="text-muted-foreground">/ {images.length}</span>
            {processedIds?.has(selected.id) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-950 dark:text-green-300">
                <CheckCircle2 className="size-3" />
                Procesada
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="size-8 rounded-full"
            disabled={selectedIndex >= images.length - 1}
            onClick={() => onSelect(images[selectedIndex + 1].id)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-4">
      {/* Thumbnails sidebar */}
      <div className="flex w-20 shrink-0 flex-col gap-2 overflow-y-auto rounded-xl bg-muted/30 p-2">
        {images.map((img, i) => {
          const processed = processedIds?.has(img.id);
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => onSelect(img.id)}
              className={cn(
                "group relative overflow-hidden rounded-lg border-2 transition-all duration-200",
                img.id === selectedId
                  ? "border-primary shadow-md shadow-primary/20"
                  : "border-transparent opacity-60 hover:opacity-100 hover:border-muted-foreground/20"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={`Miniatura ${i + 1}`}
                className="aspect-[3/4] w-full object-cover"
              />
              {processed && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition-opacity group-hover:opacity-100">
                  <CheckCircle2 className="size-4 text-green-400 drop-shadow-lg" />
                </div>
              )}
              {processed && img.id !== selectedId && (
                <CheckCircle2 className="absolute right-0.5 top-0.5 size-3.5 text-green-500 drop-shadow" />
              )}
            </button>
          );
        })}
      </div>

      {/* Main image */}
      <div className="min-w-0 flex-1 overflow-hidden rounded-xl border bg-muted/20 shadow-sm">
        <ImageWithZoom
          src={selected.url}
          alt="Documento seleccionado"
          highlightedBbox={highlightedBbox}
          overlays={overlays}
          calibration={calibration}
          onMetricsChange={onMetricsChange}
          drawBboxMode={drawBboxMode}
          onBboxDrawn={onBboxDrawn}
          onCancelDraw={onCancelDraw}
        />
      </div>
    </div>
  );
}
