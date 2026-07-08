"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CameraInput } from "@/components/driver/CameraInput";
import { CropEditor } from "@/components/driver/CropEditor";
import { OptimizationProgress } from "@/components/driver/OptimizationProgress";
import {
  CapturedImagesList,
  type CapturedImage,
} from "@/components/driver/CapturedImagesList";
import { useImagePipeline } from "@/hooks/use-image-pipeline";
import { useUploadImages } from "@/features/records/mutations";
import { useRecord } from "@/features/records/queries";
import { useSessionStore } from "@/features/auth/session-store";
import { canAppendImagesToRecord } from "@/features/records/types";
import { COPY, PIPELINE_ENHANCE_BY_DEFAULT } from "@/lib/constants";
import { toast } from "sonner";

type Stage = "idle" | "cropping" | "preview";

function CapturePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const appendRecordId = searchParams.get("recordId")?.trim() || undefined;

  const { deviceId, driverId, driverName } = useSessionStore();
  const { processBlob, step, progress, isProcessing } = useImagePipeline();
  const upload = useUploadImages();
  const { data: existingRecord } = useRecord(appendRecordId ?? "");

  const [stage, setStage] = useState<Stage>("idle");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewOriginal, setPreviewOriginal] = useState<string | null>(null);
  const [previewProcessed, setPreviewProcessed] = useState<string | null>(null);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [enhance, setEnhance] = useState<boolean>(PIPELINE_ENHANCE_BY_DEFAULT);

  const isAppend = Boolean(appendRecordId);
  const appendBlocked =
    isAppend &&
    existingRecord &&
    !canAppendImagesToRecord(existingRecord.status);

  const handleCapture = (file: File) => {
    setPendingFile(file);
    setStage("cropping");
  };

  const handleCropConfirm = async (croppedBlob: Blob) => {
    try {
      const { originalDataUrl, processedDataUrl } = await processBlob(
        croppedBlob,
        { enhance }
      );
      setPreviewOriginal(originalDataUrl);
      setPreviewProcessed(processedDataUrl);
      setStage("preview");
    } catch {
      toast.error("No se pudo optimizar la imagen");
      setStage("idle");
    }
  };

  const handleCropCancel = () => {
    setPendingFile(null);
    setStage("idle");
  };

  const confirmImage = () => {
    if (!previewOriginal || !previewProcessed) return;
    setImages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        dataUrl: previewOriginal,
        processedDataUrl: previewProcessed,
        name: `doc-${prev.length + 1}.jpg`,
      },
    ]);
    setPreviewOriginal(null);
    setPreviewProcessed(null);
    setPendingFile(null);
    setStage("idle");
    toast.success("Imagen agregada al registro");
  };

  const handleSend = () => {
    if (!deviceId || !driverId || !driverName) {
      toast.error("Sesión no válida");
      return;
    }
    if (images.length === 0) {
      toast.error("Agrega al menos una imagen");
      return;
    }
    if (appendBlocked) {
      toast.error("Este envío ya no admite más imágenes");
      return;
    }

    upload.mutate(
      {
        deviceId,
        driverId,
        driverName,
        recordId: appendRecordId,
        images: images.map((i) => ({
          dataUrl: i.dataUrl,
          processedDataUrl: i.processedDataUrl,
          name: i.name,
        })),
      },
      {
        onSuccess: () => {
          toast.success(
            isAppend
              ? "Imágenes agregadas al envío"
              : "Envío realizado correctamente"
          );
          router.push(isAppend ? `/driver/${appendRecordId}` : "/driver");
        },
        onError: (err) =>
          toast.error(err instanceof Error ? err.message : "Error al enviar"),
      }
    );
  };

  return (
    <div className="animate-fade-in mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-6">
      <Link
        href={isAppend ? `/driver/${appendRecordId}` : "/driver"}
        className="inline-flex h-8 w-fit items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-colors hover:bg-muted"
      >
        <ArrowLeft className="size-4" />
        Volver
      </Link>

      <div className="space-y-1.5">
        <h1 className="text-xl font-bold sm:text-2xl">
          {isAppend ? "Agregar imágenes" : "Nuevo registro"}
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {isAppend
            ? existingRecord
              ? `Se añadirán al envío actual (${existingRecord.images.length} imagen${existingRecord.images.length === 1 ? "" : "es"} ya enviada${existingRecord.images.length === 1 ? "" : "s"}).`
              : "Se añadirán al envío seleccionado."
            : "Toma fotos de los documentos. Podrás ajustar el recorte antes de guardarlas."}
        </p>
      </div>

      {appendBlocked && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          Este envío está en estado «{existingRecord?.status}» y no admite más
          fotos.
        </p>
      )}

      {isProcessing && <OptimizationProgress step={step} progress={progress} />}

      {stage === "cropping" && pendingFile && (
        <CropEditor
          file={pendingFile}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      {stage === "preview" && previewOriginal && (
        <div className="animate-scale-in space-y-3">
          <div className="overflow-hidden rounded-xl border bg-muted/20 shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewOriginal}
              alt="Vista previa"
              className="max-h-[50vh] w-full object-contain"
            />
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Se guardan dos versiones: una nítida para revisión y una liviana
            que se envía al modelo de IA.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={() => {
                setPreviewOriginal(null);
                setPreviewProcessed(null);
                setStage("cropping");
              }}
              disabled={isProcessing}
              className="h-11"
            >
              Ajustar recorte
            </Button>
            <Button
              onClick={confirmImage}
              disabled={isProcessing}
              className="h-11 shadow-sm"
            >
              {COPY.driver.confirm}
            </Button>
          </div>
        </div>
      )}

      {stage === "idle" && !appendBlocked && (
        <div className="space-y-3">
          <CameraInput
            onCapture={handleCapture}
            disabled={isProcessing}
            label={
              images.length === 0 ? "Tomar foto" : COPY.driver.addMore
            }
          />
          <label className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3 text-xs shadow-sm transition-all hover:border-primary/20 hover:shadow-md">
            <span>
              <span className="font-medium">Realzar contraste (avanzado)</span>
              <span className="mt-0.5 block text-[10px] leading-relaxed text-muted-foreground">
                Útil solo si la foto tiene mucha sombra. Por defecto está
                apagado: tiende a engrosar los trazos manuscritos.
              </span>
            </span>
            <input
              type="checkbox"
              checked={enhance}
              onChange={(e) => setEnhance(e.target.checked)}
              className="size-4 accent-primary"
            />
          </label>
        </div>
      )}

      <CapturedImagesList
        images={images}
        onRemove={(id) => setImages((prev) => prev.filter((i) => i.id !== id))}
      />

      {images.length > 0 && stage === "idle" && !appendBlocked && (
        <Button
          size="lg"
          variant="glow"
          className="animate-fade-in-up h-14 w-full gap-2.5 active:scale-[0.98]"
          onClick={handleSend}
          disabled={upload.isPending || isProcessing}
        >
          <Send className="size-5" />
          {upload.isPending
            ? "Enviando…"
            : isAppend
              ? `Agregar al envío (${images.length})`
              : `${COPY.driver.send} (${images.length})`}
        </Button>
      )}
    </div>
  );
}

export default function CapturePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-4">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando captura…</p>
        </div>
      }
    >
      <CapturePageInner />
    </Suspense>
  );
}
