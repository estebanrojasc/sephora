"use client";

import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProcessAIButtonProps {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Si true, indica que ya hay una extracción previa y este botón "añade datos". */
  isAddingToExisting?: boolean;
  /** Cuántas imágenes se procesarán en esta corrida. */
  imageCount?: number;
}

export function ProcessAIButton({
  onClick,
  loading,
  disabled,
  isAddingToExisting,
  imageCount,
}: ProcessAIButtonProps) {
  const baseLabel = loading
    ? "Procesando con IA…"
    : isAddingToExisting
      ? "Reprocesar con IA"
      : "Procesar con IA";
  const suffix =
    imageCount && imageCount > 1 && !loading
      ? ` · ${imageCount} hojas`
      : "";
  return (
    <Button
      size="lg"
      variant="glow"
      className="w-full gap-2"
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <Loader2 className="size-5 animate-spin" />
      ) : (
        <Sparkles className="size-5" />
      )}
      {baseLabel}
      {suffix}
    </Button>
  );
}
