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
        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="icon"
            disabled={selectedIndex === 0}
            onClick={() => onSelect(images[selectedIndex - 1].id)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {selectedIndex + 1} / {images.length}
            {processedIds?.has(selected.id) && " · procesada"}
          </span>
          <Button
            variant="outline"
            size="icon"
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
    <div className="flex h-full min-h-0 gap-3">
      <div className="flex w-24 shrink-0 flex-col gap-2 overflow-y-auto">
        {images.map((img) => {
          const processed = processedIds?.has(img.id);
          return (
            <button
              key={img.id}
              type="button"
              onClick={() => onSelect(img.id)}
              className={cn(
                "relative overflow-hidden rounded-md border-2 transition-colors",
                img.id === selectedId
                  ? "border-primary"
                  : "border-transparent opacity-70 hover:opacity-100"
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                className="aspect-[3/4] w-full object-cover"
              />
              {processed && (
                <CheckCircle2 className="absolute right-1 top-1 size-4 text-green-500 drop-shadow" />
              )}
            </button>
          );
        })}
      </div>
      <div className="min-w-0 flex-1">
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
