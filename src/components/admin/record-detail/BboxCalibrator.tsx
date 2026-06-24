"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  DEFAULT_CALIBRATION,
  type BboxCalibration,
  type BboxFormat,
} from "@/features/records/overlays";

interface BboxCalibratorProps {
  calibration: BboxCalibration;
  detectedFormat: BboxFormat;
  imageSize?: { w: number; h: number } | null;
  onChange: (next: BboxCalibration) => void;
}

const FORMAT_LABELS: Record<BboxFormat, string> = {
  "norm-1000": "0–1000 (Qwen-VL estándar)",
  "norm-1": "0–1 (decimal)",
  px: "Píxeles del modelo",
};

export function BboxCalibrator({
  calibration,
  detectedFormat,
  imageSize,
  onChange,
}: BboxCalibratorProps) {
  const unit = calibration.format === "norm-1" ? 1 : 1000;
  const offsetRange = unit * 0.15;
  const offsetStep = unit === 1 ? 0.005 : 5;

  const update = (patch: Partial<BboxCalibration>) =>
    onChange({ ...calibration, ...patch });

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">Calibrador de bboxes</p>
          <p className="text-[10px] text-muted-foreground">
            Formato detectado:{" "}
            <code className="font-mono">{detectedFormat}</code>
            {imageSize && ` · imagen ${imageSize.w}×${imageSize.h}px`}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange({ ...DEFAULT_CALIBRATION, format: detectedFormat })}
        >
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] text-muted-foreground">Formato</Label>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(FORMAT_LABELS) as BboxFormat[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => update({ format: f })}
              className={
                "rounded-md border px-2 py-1 text-[11px] transition-colors " +
                (calibration.format === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent")
              }
            >
              {FORMAT_LABELS[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <SliderField
          label="Offset X"
          value={calibration.offsetX}
          min={-offsetRange}
          max={offsetRange}
          step={offsetStep}
          onChange={(offsetX) => update({ offsetX })}
        />
        <SliderField
          label="Offset Y"
          value={calibration.offsetY}
          min={-offsetRange}
          max={offsetRange}
          step={offsetStep}
          onChange={(offsetY) => update({ offsetY })}
        />
        <SliderField
          label="Escala X"
          value={calibration.scaleX}
          min={0.5}
          max={1.5}
          step={0.005}
          onChange={(scaleX) => update({ scaleX })}
          precision={3}
        />
        <SliderField
          label="Escala Y"
          value={calibration.scaleY}
          min={0.5}
          max={1.5}
          step={0.005}
          onChange={(scaleY) => update({ scaleY })}
          precision={3}
        />
      </div>

      <p className="text-[10px] text-muted-foreground">
        Tip: si todas las cajas están corridas a un lado, ajusta el offset. Si
        están infladas o encogidas en general, mueve la escala. Solo afecta la
        visualización, no la respuesta del modelo.
      </p>
    </div>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  precision?: number;
  onChange: (v: number) => void;
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  precision = 2,
  onChange,
}: SliderFieldProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] text-muted-foreground">{label}</Label>
        <span className="font-mono text-[10px] tabular-nums">
          {value.toFixed(precision)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
      />
    </div>
  );
}
