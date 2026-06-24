"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ImageGallery } from "@/components/admin/record-detail/ImageGallery";
import { ExtractionPanel } from "@/components/admin/record-detail/ExtractionPanel";
import { PdfExportButton } from "@/components/admin/PdfExportButton";
import { ExcelExportButton } from "@/components/admin/ExcelExportButton";
import { useRecord } from "@/features/records/queries";
import {
  useOpenRecord,
  useReleaseRecord,
} from "@/features/records/mutations";
import { useIsDesktop } from "@/hooks/use-media-query";
import { formatDate } from "@/lib/format";
import type { Bbox, Extraction } from "@/features/records/types";
import { getRecordConductorLabel } from "@/features/records/display";
import {
  collectOverlays,
  DEFAULT_CALIBRATION,
  type BboxCalibration,
  type BboxFormat,
} from "@/features/records/overlays";
import { BboxCalibrator } from "@/components/admin/record-detail/BboxCalibrator";
import {
  BboxEditContext,
  type BboxEditContextValue,
} from "@/components/admin/record-detail/bbox-edit-context";
import { toast } from "sonner";

export default function RecordDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const isDesktop = useIsDesktop();

  const { data: record, isLoading, error } = useRecord(id);
  const openRecord = useOpenRecord();
  const releaseRecord = useReleaseRecord();

  const [liveExtraction, setLiveExtraction] = useState<Extraction | null>(null);

  useEffect(() => {
    setLiveExtraction(record?.extraction ?? null);
  }, [record?.id, record?.extraction]);

  const conductorLabel = useMemo(
    () => (record ? getRecordConductorLabel(record, liveExtraction) : "—"),
    [record, liveExtraction]
  );

  const [selectedImageId, setSelectedImageId] = useState<string>("");
  const [highlightedBbox, setHighlightedBbox] = useState<Bbox | null>(null);
  // Resaltado al hover/focus encendido por default: es la interacción
  // principal del operador para verificar dónde sacó cada dato la IA.
  const [hoverBboxEnabled, setHoverBboxEnabled] = useState(true);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibration, setCalibration] = useState<BboxCalibration>(
    DEFAULT_CALIBRATION
  );
  const [detectedFormat, setDetectedFormat] = useState<BboxFormat>("norm-1000");
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(
    null
  );
  // Estado para edición manual de bbox por campo.
  const [editingBboxId, setEditingBboxId] = useState<string | null>(null);
  const [pendingBboxSetter, setPendingBboxSetter] = useState<
    ((bbox: Bbox) => void) | null
  >(null);

  const requestBboxEdit = useCallback(
    (id: string, setter: (bbox: Bbox) => void) => {
      setEditingBboxId(id);
      // Guardamos la función envuelta para evitar que React la ejecute como updater.
      setPendingBboxSetter(() => setter);
      toast("Dibuja la caja sobre la imagen", {
        description: "Click y arrastra para marcar la posición del campo.",
      });
    },
    []
  );

  const handleBboxDrawn = useCallback(
    (bbox: Bbox) => {
      pendingBboxSetter?.(bbox);
      setEditingBboxId(null);
      setPendingBboxSetter(null);
      toast.success("Caja actualizada");
    },
    [pendingBboxSetter]
  );

  const cancelBboxEdit = useCallback(() => {
    setEditingBboxId(null);
    setPendingBboxSetter(null);
  }, []);

  const handleHoverBbox = useCallback(
    (bbox: Bbox | null) => {
      setHighlightedBbox(hoverBboxEnabled ? bbox : null);
    },
    [hoverBboxEnabled]
  );

  const bboxEditContextValue = useMemo<BboxEditContextValue>(
    () => ({ activeId: editingBboxId, requestEdit: requestBboxEdit }),
    [editingBboxId, requestBboxEdit]
  );

  useEffect(() => {
    if (id) openRecord.mutate(id);
    return () => {
      if (id) releaseRecord.mutate(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-seleccionar la primera imagen sin un useEffect dedicado: si el
  // selectedImageId no apunta a una imagen presente del registro, lo
  // ajustamos durante el render.
  const fallbackImageId = record?.images[0]?.id;
  const effectiveSelectedId =
    selectedImageId && record?.images.some((i) => i.id === selectedImageId)
      ? selectedImageId
      : (fallbackImageId ?? "");
  if (
    fallbackImageId &&
    selectedImageId !== effectiveSelectedId &&
    selectedImageId === ""
  ) {
    // Solo escribimos cuando aún no hay selección, evita actualizaciones
    // continuas durante el render.
    setSelectedImageId(effectiveSelectedId);
  }

  const recordExtraction = record?.extraction;
  const processedIds = useMemo(
    () => new Set(recordExtraction?._meta?.processedImageIds ?? []),
    [recordExtraction]
  );

  const overlays = useMemo(
    () =>
      calibrationMode && recordExtraction
        ? collectOverlays(recordExtraction)
        : undefined,
    [calibrationMode, recordExtraction]
  );

  const handleMetricsChange = useCallback(
    ({
      detectedFormat,
      naturalWidth,
      naturalHeight,
    }: {
      detectedFormat: BboxFormat;
      naturalWidth: number;
      naturalHeight: number;
    }) => {
      setDetectedFormat((prev) =>
        prev === detectedFormat ? prev : detectedFormat
      );
      setImageSize((prev) =>
        prev?.w === naturalWidth && prev?.h === naturalHeight
          ? prev
          : { w: naturalWidth, h: naturalHeight }
      );
      setCalibration((prev) => {
        const untouched =
          prev.offsetX === 0 &&
          prev.offsetY === 0 &&
          prev.scaleX === 1 &&
          prev.scaleY === 1;

        if (!untouched || prev.format === detectedFormat) return prev;
        return { ...prev, format: detectedFormat };
      });
    },
    []
  );

  if (error) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-start gap-3 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Registro no disponible</h2>
        <p className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : "Error desconocido"}.
        </p>
        <p className="text-xs text-muted-foreground">
          Verifica que MongoDB esté corriendo y que el ID corresponda a un
          registro existente. Si el ID es de una sesión anterior eliminada,
          vuelve al panel y crea uno nuevo desde el conductor.
        </p>
        <Link
          href="/admin"
          className="inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-sm hover:bg-muted"
        >
          <ArrowLeft className="size-4" />
          Volver al panel
        </Link>
      </div>
    );
  }

  if (isLoading || !record) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Cargando registro…
      </div>
    );
  }

  const gallery = (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {calibrationMode && (
        <BboxCalibrator
          calibration={calibration}
          detectedFormat={detectedFormat}
          imageSize={imageSize}
          onChange={setCalibration}
        />
      )}
      <div className="min-h-0 flex-1">
        <ImageGallery
          images={record.images}
          selectedId={effectiveSelectedId}
          onSelect={setSelectedImageId}
          processedIds={processedIds}
          highlightedBbox={highlightedBbox}
          overlays={overlays}
          calibration={calibrationMode ? calibration : undefined}
          onMetricsChange={handleMetricsChange}
          drawBboxMode={editingBboxId !== null}
          onBboxDrawn={handleBboxDrawn}
          onCancelDraw={cancelBboxEdit}
        />
      </div>
    </div>
  );

  const extraction = (
    <ExtractionPanel
      record={record}
      onHoverBbox={handleHoverBbox}
      onLiveExtractionChange={setLiveExtraction}
    />
  );

  return (
    <BboxEditContext.Provider value={bboxEditContextValue}>
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/admin"
            className="inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-sm hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
            Volver
          </Link>
          <div>
            <p className="font-mono text-sm text-muted-foreground">
              {record.id.slice(0, 8)}…
            </p>
            <p className="text-sm">
              {conductorLabel} · {formatDate(record.createdAt)}
            </p>
          </div>
          <StatusBadge status={record.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={hoverBboxEnabled ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setHoverBboxEnabled((v) => !v);
              setHighlightedBbox(null);
            }}
            disabled={!record.extraction}
            title="Resaltar una caja al pasar el mouse sobre un campo"
          >
            {hoverBboxEnabled ? "Resaltado activo" : "Resaltado off"}
          </Button>
          <Button
            variant={calibrationMode ? "default" : "outline"}
            size="sm"
            onClick={() => setCalibrationMode((v) => !v)}
            disabled={!record.extraction}
            title="Pintar todas las cajas detectadas por la IA"
          >
            <ScanLine className="size-4" />
            {calibrationMode ? "Ocultar cajas" : "Ver todas las cajas"}
          </Button>
          <PdfExportButton record={record} />
          <ExcelExportButton record={record} />
        </div>
      </div>

      {isDesktop ? (
        <ResizablePanelGroup
          orientation="horizontal"
          className="min-h-0 flex-1 rounded-lg border"
        >
          <ResizablePanel defaultSize={55} minSize={35}>
            <div className="h-full overflow-auto p-4">{gallery}</div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={45} minSize={30}>
            <div className="h-full overflow-auto p-4">{extraction}</div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <Tabs defaultValue="gallery" className="min-h-0 flex-1">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="gallery">Galería</TabsTrigger>
            <TabsTrigger value="data">Datos</TabsTrigger>
          </TabsList>
          <TabsContent value="gallery" className="mt-4 min-h-0 flex-1">
            {gallery}
          </TabsContent>
          <TabsContent value="data" className="mt-4">
            {extraction}
          </TabsContent>
        </Tabs>
      )}
    </div>
    </BboxEditContext.Provider>
  );
}
