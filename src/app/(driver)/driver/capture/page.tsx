"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send } from "lucide-react";
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
import { useSessionStore } from "@/features/auth/session-store";
import { COPY, PIPELINE_ENHANCE_BY_DEFAULT } from "@/lib/constants";
import { toast } from "sonner";

type Stage = "idle" | "cropping" | "preview";

export default function CapturePage() {
  const router = useRouter();
  const { deviceId, driverId, driverName } = useSessionStore();
  const { processBlob, step, progress, isProcessing } = useImagePipeline();
  const upload = useUploadImages();

  const [stage, setStage] = useState<Stage>("idle");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewOriginal, setPreviewOriginal] = useState<string | null>(null);
  const [previewProcessed, setPreviewProcessed] = useState<string | null>(null);
  const [images, setImages] = useState<CapturedImage[]>([]);
  const [enhance, setEnhance] = useState<boolean>(PIPELINE_ENHANCE_BY_DEFAULT);

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

    upload.mutate(
      {
        deviceId,
        driverId,
        driverName,
        images: images.map((i) => ({
          dataUrl: i.dataUrl,
          processedDataUrl: i.processedDataUrl,
          name: i.name,
        })),
      },
      {
        onSuccess: () => {
          toast.success("Envío realizado correctamente");
          router.push("/driver");
        },
        onError: () => toast.error("Error al enviar"),
      }
    );
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-6">
      <Link
        href="/driver"
        className="inline-flex h-7 w-fit items-center gap-1 rounded-lg px-2.5 text-sm hover:bg-muted"
      >
        <ArrowLeft className="size-4" />
        Volver
      </Link>

      <div className="space-y-1">
        <h1 className="text-xl font-semibold sm:text-2xl">Nuevo registro</h1>
        <p className="text-sm text-muted-foreground">
          Toma fotos de los documentos. Podrás ajustar el recorte antes de
          guardarlas.
        </p>
      </div>

      {isProcessing && <OptimizationProgress step={step} progress={progress} />}

      {stage === "cropping" && pendingFile && (
        <CropEditor
          file={pendingFile}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      {stage === "preview" && previewOriginal && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewOriginal}
              alt="Vista previa"
              className="max-h-[50vh] w-full object-contain"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
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
            >
              Ajustar recorte
            </Button>
            <Button onClick={confirmImage} disabled={isProcessing}>
              {COPY.driver.confirm}
            </Button>
          </div>
        </div>
      )}

      {stage === "idle" && (
        <div className="space-y-2">
          <CameraInput
            onCapture={handleCapture}
            disabled={isProcessing}
            label={
              images.length === 0 ? "Tomar foto" : COPY.driver.addMore
            }
          />
          <label className="flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 text-xs">
            <span>
              <span className="font-medium">Realzar contraste (avanzado)</span>
              <span className="block text-[10px] text-muted-foreground">
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

      {images.length > 0 && stage === "idle" && (
        <Button
          size="lg"
          className="h-14 w-full bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md hover:from-indigo-500 hover:to-violet-500"
          onClick={handleSend}
          disabled={upload.isPending || isProcessing}
        >
          <Send className="size-5" />
          {upload.isPending
            ? "Enviando…"
            : `${COPY.driver.send} (${images.length})`}
        </Button>
      )}
    </div>
  );
}
