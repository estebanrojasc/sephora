"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ImageGallery } from "@/components/admin/record-detail/ImageGallery";
import { ExtractionPanel } from "@/components/admin/record-detail/ExtractionPanel";
import { RecordDetailActions } from "@/components/admin/record-detail/RecordDetailActions";
import { useRecord } from "@/features/records/queries";
import {
  useOpenRecord,
  useProcessAI,
  useReleaseRecord,
} from "@/features/records/mutations";
import { useIsDesktop, useIsCoarsePointer } from "@/hooks/use-media-query";
import { formatDate } from "@/lib/format";
import type { Bbox, Extraction, Record } from "@/features/records/types";
import { ensureExtractionShape } from "@/features/records/types";
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

interface RecordDetailPageClientProps {
  id: string;
}

export function RecordDetailPageClient({ id }: RecordDetailPageClientProps) {
  const { data: record, isLoading, error } = useRecord(id);
  const openRecord = useOpenRecord();
  const releaseRecord = useReleaseRecord();
  const aiPendingRef = useRef(false);
  const processAI = useProcessAI();

  useEffect(() => {
    aiPendingRef.current = processAI.isPending;
  }, [processAI.isPending]);

  useEffect(() => {
    if (id) openRecord.mutate(id);
    return () => {
      if (id && !aiPendingRef.current) releaseRecord.mutate(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  return (
    <RecordDetailBody
      key={record.id}
      record={record}
      processAI={processAI}
    />
  );
}

function RecordDetailBody({
  record,
  processAI,
}: {
  record: Record;
  processAI: ReturnType<typeof useProcessAI>;
}) {
  const isDesktop = useIsDesktop();
  const isCoarsePointer = useIsCoarsePointer();

  const [liveExtraction, setLiveExtraction] = useState<Extraction | null>(() =>
    record.extraction ? ensureExtractionShape(record.extraction) : null
  );
  const [selectedImageId, setSelectedImageId] = useState(
    record.images[0]?.id ?? ""
  );
  const [highlightedBbox, setHighlightedBbox] = useState<Bbox | null>(null);
  const [hoverBboxEnabled, setHoverBboxEnabled] = useState(true);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibration, setCalibration] = useState<BboxCalibration>(
    DEFAULT_CALIBRATION
  );
  const [detectedFormat, setDetectedFormat] = useState<BboxFormat>("norm-1000");
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(
    null
  );
  const [editingBboxId, setEditingBboxId] = useState<string | null>(null);
  const [pendingBboxSetter, setPendingBboxSetter] = useState<
    ((bbox: Bbox) => void) | null
  >(null);

  const conductorLabel = useMemo(
    () => getRecordConductorLabel(record, liveExtraction),
    [record, liveExtraction]
  );

  const requestBboxEdit = useCallback(
    (fieldId: string, setter: (bbox: Bbox) => void) => {
      setEditingBboxId(fieldId);
      setPendingBboxSetter(() => setter);
      toast("Dibuja la caja sobre la imagen", {
        description: isCoarsePointer
          ? "Toca y arrastra para marcar la posición del campo."
          : "Click y arrastra para marcar la posición del campo.",
      });
    },
    [isCoarsePointer]
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

  const effectiveSelectedId =
    selectedImageId && record.images.some((i) => i.id === selectedImageId)
      ? selectedImageId
      : (record.images[0]?.id ?? "");

  const recordExtraction = record.extraction;
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
      detectedFormat: nextFormat,
      naturalWidth,
      naturalHeight,
    }: {
      detectedFormat: BboxFormat;
      naturalWidth: number;
      naturalHeight: number;
    }) => {
      setDetectedFormat((prev) =>
        prev === nextFormat ? prev : nextFormat
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

        if (!untouched || prev.format === nextFormat) return prev;
        return { ...prev, format: nextFormat };
      });
    },
    []
  );

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
      processAI={processAI}
      onHoverBbox={handleHoverBbox}
      onLiveExtractionChange={setLiveExtraction}
    />
  );

  return (
    <BboxEditContext.Provider value={bboxEditContextValue}>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
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
          <RecordDetailActions
            record={record}
            hoverBboxEnabled={hoverBboxEnabled}
            onHoverBboxEnabledChange={(enabled) => {
              setHoverBboxEnabled(enabled);
              if (!enabled) setHighlightedBbox(null);
            }}
            calibrationMode={calibrationMode}
            onCalibrationModeChange={setCalibrationMode}
          />
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
          <Tabs defaultValue="gallery" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="grid w-full shrink-0 grid-cols-2">
              <TabsTrigger value="gallery">Galería</TabsTrigger>
              <TabsTrigger value="data">Datos</TabsTrigger>
            </TabsList>
            <TabsContent
              value="gallery"
              className="mt-4 min-h-0 flex-1 overflow-auto"
            >
              {gallery}
            </TabsContent>
            <TabsContent
              value="data"
              className="mt-4 min-h-0 flex-1 overflow-auto"
            >
              {extraction}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </BboxEditContext.Provider>
  );
}
