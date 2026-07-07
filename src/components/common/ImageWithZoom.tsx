"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCw, ZoomIn, ZoomOut, PencilRuler } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Bbox } from "@/features/records/types";
import {
  bboxToCss,
  detectBboxFormat,
  type BboxCalibration,
  type BboxFormat,
  type BboxOverlay,
} from "@/features/records/overlays";
import { cn } from "@/lib/utils";
import { useIsCoarsePointer } from "@/hooks/use-media-query";

interface ImageWithZoomProps {
  src: string;
  alt: string;
  className?: string;
  /**
   * bbox sobre el que el usuario está haciendo hover. La imagen hace zoom
   * automático y centra esa zona. Al volverse `null`, se restaura la vista
   * (solo si el último cambio había sido por hover, no por el usuario).
   */
  highlightedBbox?: Bbox | null;
  /** Conjunto de bboxes a pintar (modo calibración). */
  overlays?: BboxOverlay[];
  showLabels?: boolean;
  /** Calibración manual aplicada sobre los bboxes (offset + escala + formato). */
  calibration?: BboxCalibration;
  /** Notifica el formato detectado y dimensiones reales al cargar la imagen. */
  onMetricsChange?: (info: {
    detectedFormat: BboxFormat;
    naturalWidth: number;
    naturalHeight: number;
  }) => void;
  /**
   * Si se provee, activa el modo "dibujar bbox": el usuario hace click y
   * arrastra sobre la imagen y al soltar se llama este callback con el bbox
   * en coords 0-1000 (norm-1000). El padre decide qué hacer con el resultado.
   */
  drawBboxMode?: boolean;
  onBboxDrawn?: (bbox: Bbox) => void;
  /** Cancela el modo dibujo (botón "Cancelar"). */
  onCancelDraw?: () => void;
}

interface DrawingState {
  pointerId: number;
  startX: number;
  startY: number;
  curX: number;
  curY: number;
}

/** Zoom objetivo al hacer hover sobre un bbox. */
const HOVER_ZOOM = 2.5;

export function ImageWithZoom({
  src,
  alt,
  className,
  highlightedBbox,
  overlays,
  showLabels = true,
  calibration,
  onMetricsChange,
  drawBboxMode = false,
  onBboxDrawn,
  onCancelDraw,
}: ImageWithZoomProps) {
  const isCoarsePointer = useIsCoarsePointer();
  const drawHint = isCoarsePointer
    ? "Toca y arrastra para marcar la caja"
    : "Click y arrastra para marcar la caja";
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  /**
   * Marca true cuando el último cambio de pan/scale fue producto del hover.
   * Si el usuario interactúa manualmente (botones, arrastrar) se vuelve false
   * y entonces ya no se restaura automáticamente al sacar el hover.
   */
  const hoverDrivenRef = useRef(false);
  const panDragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
  } | null>(null);

  const allBboxes = useMemo<Bbox[]>(() => {
    const list: Bbox[] = [];
    overlays?.forEach((o) => list.push(o.bbox));
    if (highlightedBbox && highlightedBbox.some((v) => v !== 0)) {
      list.push(highlightedBbox);
    }
    return list;
  }, [overlays, highlightedBbox]);

  const detectedFormat = useMemo(
    () => detectBboxFormat(allBboxes),
    [allBboxes]
  );

  const effectiveCalibration: BboxCalibration = useMemo(
    () =>
      calibration ?? {
        format: detectedFormat,
        offsetX: 0,
        offsetY: 0,
        scaleX: 1,
        scaleY: 1,
      },
    [calibration, detectedFormat]
  );

  const markUserInteraction = () => {
    hoverDrivenRef.current = false;
  };

  const resetView = () => {
    hoverDrivenRef.current = false;
    setScale(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  /**
   * Aplica un zoom hacia el bbox: el centro del bbox queda en el centro del
   * viewport tras la transformación `translate(pan) scale(s) rotate(r)` con
   * `transform-origin: center`. Asume rotación = 0 (el usuario rara vez rota
   * mientras hace hover).
   */
  useEffect(() => {
    if (drawBboxMode) return; // mientras dibuja, no movemos la imagen
    if (!highlightedBbox || !imgRef.current) return;
    const hasReal = highlightedBbox.some((v) => v !== 0);
    if (!hasReal) return;

    const style = bboxToCss(
      highlightedBbox,
      effectiveCalibration,
      size?.w,
      size?.h
    );
    if (!style) return;

    // Extraemos cx, cy en [0,1] desde las strings de porcentaje.
    const pct = (val: unknown): number => {
      if (typeof val !== "string") return 0;
      const m = val.match(/^([\d.]+)%$/);
      return m ? Number(m[1]) / 100 : 0;
    };
    const left = pct((style as Record<string, unknown>).left);
    const top = pct((style as Record<string, unknown>).top);
    const width = pct((style as Record<string, unknown>).width);
    const height = pct((style as Record<string, unknown>).height);
    const cx = left + width / 2;
    const cy = top + height / 2;

    const imgW = imgRef.current.offsetWidth;
    const imgH = imgRef.current.offsetHeight;
    if (!imgW || !imgH) return;

    const targetScale = HOVER_ZOOM;
    const targetPanX = -(cx - 0.5) * imgW * targetScale;
    const targetPanY = -(cy - 0.5) * imgH * targetScale;

    hoverDrivenRef.current = true;
    setScale(targetScale);
    setPan({ x: targetPanX, y: targetPanY });
  }, [highlightedBbox, effectiveCalibration, size?.w, size?.h, drawBboxMode]);

  // Cuando el usuario quita el hover (highlightedBbox vuelve a null) y la
  // vista actual la había puesto el hover, regresamos suavemente al inicio.
  useEffect(() => {
    if (highlightedBbox) return;
    if (!hoverDrivenRef.current) return;
    setScale(1);
    setPan({ x: 0, y: 0 });
    hoverDrivenRef.current = false;
  }, [highlightedBbox]);

  /** Devuelve coords [0,1] dentro de la imagen, considerando getBoundingClientRect. */
  const clientToNormalized = (clientX: number, clientY: number) => {
    if (!imgRef.current) return null;
    const rect = imgRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    return { x: clamp(x, 0, 1), y: clamp(y, 0, 1) };
  };

  return (
    <div className={cn("relative flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => {
            markUserInteraction();
            setScale((s) => Math.min(s + 0.25, 4));
          }}
          aria-label="Acercar"
        >
          <ZoomIn className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => {
            markUserInteraction();
            setScale((s) => {
              const next = Math.max(s - 0.25, 0.5);
              if (next <= 1) setPan({ x: 0, y: 0 });
              return next;
            });
          }}
          aria-label="Alejar"
        >
          <ZoomOut className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          onClick={() => {
            markUserInteraction();
            setRotation((r) => (r + 90) % 360);
          }}
          aria-label="Rotar"
        >
          <RotateCw className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={resetView}
          className="h-8 px-2 text-xs"
        >
          Reset vista
        </Button>
        {allBboxes.length > 0 && (
          <span className="ml-2 text-[10px] text-muted-foreground">
            bbox: <code className="font-mono">{detectedFormat}</code>
            {size && ` · img ${size.w}×${size.h}px`}
          </span>
        )}
        {drawBboxMode && (
          <div className="ml-auto flex items-center gap-2 rounded-md border border-amber-400 bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <PencilRuler className="size-3" />
            {drawHint}
            {onCancelDraw && (
              <button
                type="button"
                onClick={onCancelDraw}
                className="ml-1 underline hover:no-underline"
              >
                Cancelar
              </button>
            )}
          </div>
        )}
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-lg border bg-muted/30 touch-none select-none",
          drawBboxMode
            ? "cursor-crosshair"
            : scale > 1
              ? "cursor-grab active:cursor-grabbing"
              : "cursor-default"
        )}
        onPointerDown={(e) => {
          if (drawBboxMode) {
            const norm = clientToNormalized(e.clientX, e.clientY);
            if (!norm) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            setDrawing({
              pointerId: e.pointerId,
              startX: norm.x,
              startY: norm.y,
              curX: norm.x,
              curY: norm.y,
            });
            return;
          }
          if (scale <= 1) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          panDragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            panX: pan.x,
            panY: pan.y,
          };
          markUserInteraction();
        }}
        onPointerMove={(e) => {
          if (drawBboxMode && drawing && drawing.pointerId === e.pointerId) {
            const norm = clientToNormalized(e.clientX, e.clientY);
            if (!norm) return;
            setDrawing({ ...drawing, curX: norm.x, curY: norm.y });
            return;
          }
          const drag = panDragRef.current;
          if (!drag || drag.pointerId !== e.pointerId) return;
          setPan({
            x: drag.panX + e.clientX - drag.startX,
            y: drag.panY + e.clientY - drag.startY,
          });
        }}
        onPointerUp={(e) => {
          if (drawBboxMode && drawing && drawing.pointerId === e.pointerId) {
            const x1 = Math.min(drawing.startX, drawing.curX);
            const y1 = Math.min(drawing.startY, drawing.curY);
            const x2 = Math.max(drawing.startX, drawing.curX);
            const y2 = Math.max(drawing.startY, drawing.curY);
            // Solo emite si el rectángulo es mayor a 0.5% en cada eje
            if (x2 - x1 > 0.005 && y2 - y1 > 0.005) {
              onBboxDrawn?.([
                Math.round(x1 * 1000),
                Math.round(y1 * 1000),
                Math.round(x2 * 1000),
                Math.round(y2 * 1000),
              ]);
            }
            setDrawing(null);
            e.currentTarget.releasePointerCapture(e.pointerId);
            return;
          }
          if (panDragRef.current?.pointerId === e.pointerId) {
            panDragRef.current = null;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
        onPointerCancel={() => {
          panDragRef.current = null;
          setDrawing(null);
        }}
      >
        <div
          className="relative mx-auto inline-block origin-center transition-transform duration-200 ease-out"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale}) rotate(${rotation}deg)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt={alt}
            className="block max-h-[70vh] w-auto"
            draggable={false}
            onLoad={(e) => {
              const nextSize = {
                w: e.currentTarget.naturalWidth,
                h: e.currentTarget.naturalHeight,
              };
              setSize(nextSize);
              onMetricsChange?.({
                detectedFormat,
                naturalWidth: nextSize.w,
                naturalHeight: nextSize.h,
              });
            }}
          />
          {overlays?.map((o, i) => {
            const style = bboxToCss(
              o.bbox,
              effectiveCalibration,
              size?.w,
              size?.h
            );
            if (!style) return null;
            return (
              <div
                key={`${o.label}-${i}`}
                className={cn(
                  "pointer-events-none absolute rounded-sm border transition-all",
                  o.filled
                    ? "border-emerald-500/80 bg-emerald-400/10"
                    : "border-slate-400/60 bg-slate-400/10"
                )}
                style={style}
              >
                {showLabels && (
                  <span className="absolute -top-3 left-0 max-w-[140px] truncate rounded-sm bg-emerald-600 px-1 text-[9px] leading-tight text-white">
                    {o.label}
                  </span>
                )}
              </div>
            );
          })}
          {drawing && (
            <div
              className="pointer-events-none absolute rounded-sm border-2 border-sky-500 bg-sky-400/20"
              style={{
                left: `${Math.min(drawing.startX, drawing.curX) * 100}%`,
                top: `${Math.min(drawing.startY, drawing.curY) * 100}%`,
                width: `${Math.abs(drawing.curX - drawing.startX) * 100}%`,
                height: `${Math.abs(drawing.curY - drawing.startY) * 100}%`,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}
