import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

export interface CapturedImage {
  id: string;
  /** Versión original (alta resolución) — la que se muestra en la vista. */
  dataUrl: string;
  /** Versión procesada (la que se envía al modelo). */
  processedDataUrl: string;
  name: string;
}

interface CapturedImagesListProps {
  images: CapturedImage[];
  onRemove: (id: string) => void;
}

export function CapturedImagesList({
  images,
  onRemove,
}: CapturedImagesListProps) {
  if (images.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">
        Imágenes capturadas ({images.length})
      </p>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3 pb-2">
          {images.map((img) => (
            <div
              key={img.id}
              className="relative inline-block shrink-0 overflow-hidden rounded-lg border"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.dataUrl}
                alt={img.name}
                className="h-24 w-20 object-cover"
              />
              <Button
                type="button"
                variant="destructive"
                size="icon-sm"
                className="absolute right-1 top-1 size-6"
                onClick={() => onRemove(img.id)}
                aria-label="Eliminar imagen"
              >
                <X className="size-3" />
              </Button>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
