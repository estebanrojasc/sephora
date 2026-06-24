"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ReactCrop, {
  centerCrop,
  makeAspectCrop,
  type Crop,
  type PixelCrop,
} from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { Check, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  applyCrop,
  suggestCropRect,
  type CropRect,
} from "@/features/image-pipeline/scanic";

interface CropEditorProps {
  file: File;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

interface Detection {
  rect: CropRect | null;
  imageWidth: number;
  imageHeight: number;
}

export function CropEditor({ file, onConfirm, onCancel }: CropEditorProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<Crop | undefined>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | undefined>();
  const [detection, setDetection] = useState<Detection | null>(null);
  const [working, setWorking] = useState(false);

  // `src` se deriva del File usando useMemo, no useEffect → el lint warning
  // de set-state-in-effect desaparece y conservamos la limpieza de la URL.
  const src = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  // Cuando cambia el `file`, reiniciamos la detección. Lo hacemos
  // sincronizando `lastFile` durante el render (https://react.dev/reference/
  // react/useState#storing-information-from-previous-renders) y disparamos
  // suggestCropRect en un useEffect que sólo se encarga de "asignar el
  // resultado externo" cuando llega — sin setState directo en el body.
  const [lastFile, setLastFile] = useState<File | null>(null);
  if (lastFile !== file) {
    setLastFile(file);
    setDetection(null);
  }

  useEffect(() => {
    let cancelled = false;
    suggestCropRect(file).then((result) => {
      if (cancelled) return;
      setDetection({
        rect: result.rect,
        imageWidth: result.imageWidth,
        imageHeight: result.imageHeight,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [file]);

  const detecting = detection === null;
  const suggested = detection?.rect ?? null;
  const imageSize = detection
    ? { width: detection.imageWidth, height: detection.imageHeight }
    : null;

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!imageSize) return;
    const { width, height } = e.currentTarget;
    const initial = suggested
      ? toPercentCrop(suggested, imageSize.width, imageSize.height)
      : centerCrop(
          makeAspectCrop({ unit: "%", width: 90 }, undefined as never, width, height),
          width,
          height
        );
    setCrop(initial);
  };

  const handleReset = () => {
    if (!imgRef.current || !imageSize) return;
    if (suggested) {
      setCrop(toPercentCrop(suggested, imageSize.width, imageSize.height));
    } else {
      const { width, height } = imgRef.current;
      setCrop(
        centerCrop(
          makeAspectCrop({ unit: "%", width: 90 }, undefined as never, width, height),
          width,
          height
        )
      );
    }
  };

  const handleSelectAll = () => {
    setCrop({ unit: "%", x: 0, y: 0, width: 100, height: 100 });
  };

  const handleConfirm = async () => {
    if (!imgRef.current || !completedCrop || !imageSize) {
      onConfirm(await fileToBlob(file));
      return;
    }
    setWorking(true);
    try {
      const scaleX = imageSize.width / imgRef.current.width;
      const scaleY = imageSize.height / imgRef.current.height;
      const rect: CropRect = {
        x: completedCrop.x * scaleX,
        y: completedCrop.y * scaleY,
        width: completedCrop.width * scaleX,
        height: completedCrop.height * scaleY,
      };
      const blob = await applyCrop(file, rect);
      onConfirm(blob);
    } catch (error) {
      console.error(error);
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium">Ajusta el recorte</p>
        <p className="text-xs text-muted-foreground">
          {detecting
            ? "Detectando bordes del documento…"
            : suggested
              ? "Hemos sugerido un recorte. Ajústalo arrastrando las esquinas."
              : "No detectamos el documento. Ajusta el recorte manualmente."}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-black/5">
        <ReactCrop
          crop={crop}
          onChange={(_c, percentCrop) => setCrop(percentCrop)}
          onComplete={(c) => setCompletedCrop(c)}
          ruleOfThirds
          keepSelection
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt="Recortar documento"
            onLoad={onImageLoad}
            className="max-h-[60vh] w-full object-contain"
          />
        </ReactCrop>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={working || detecting}
        >
          <RotateCcw className="size-4" />
          Reiniciar
        </Button>
        <Button
          variant="outline"
          onClick={handleSelectAll}
          disabled={working}
        >
          Sin recortar
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onCancel} disabled={working}>
          <X className="size-4" />
          Descartar
        </Button>
        <Button onClick={handleConfirm} disabled={working || detecting}>
          <Check className="size-4" />
          {working ? "Procesando…" : "Confirmar recorte"}
        </Button>
      </div>
    </div>
  );
}

function toPercentCrop(
  rect: CropRect,
  imgWidth: number,
  imgHeight: number
): Crop {
  return {
    unit: "%",
    x: (rect.x / imgWidth) * 100,
    y: (rect.y / imgHeight) * 100,
    width: (rect.width / imgWidth) * 100,
    height: (rect.height / imgHeight) * 100,
  };
}

function fileToBlob(file: File): Promise<Blob> {
  return file.arrayBuffer().then((buf) => new Blob([buf], { type: file.type }));
}
