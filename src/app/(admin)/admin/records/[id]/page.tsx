"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ScanLine, Layers, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { StatusBadge } from "@/components/common/StatusBadge";
import { ImageGallery } from "@/components/admin/record-detail/ImageGallery";
import { ExtractionPanel } from "@/components/admin/record-detail/ExtractionPanel";
import { PdfExportButton } from "@/components/admin/PdfExportButton";
import { ExcelExportButton } from "@/components/admin/ExcelExportButton";
import { useRecord } from "@/features/records/queries";
import { useOpenRecord, useProcessAI, useReleaseRecord } from "@/features/records/mutations";
import { useIsDesktop } from "@/hooks/use-media-query";
import { formatDate } from "@/lib/format";
import type { Bbox, Extraction } from "@/features/records/types";
import { ensureExtractionShape } from "@/features/records/types";
import { getRecordConductorLabel } from "@/features/records/display";
import { collectOverlays, DEFAULT_CALIBRATION, type BboxCalibration, type BboxFormat } from "@/features/records/overlays";
import { BboxCalibrator } from "@/components/admin/record-detail/BboxCalibrator";
import { BboxEditContext, type BboxEditContextValue } from "@/components/admin/record-detail/bbox-edit-context";
import { toast } from "sonner";

export default function RecordDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const isDesktop = useIsDesktop();

  const { data: record, isLoading, error } = useRecord(id);
  const openRecord = useOpenRecord();
  const releaseRecord = useReleaseRecord();
  const processAI = useProcessAI();
  const aiPendingRef = useRef(false);

  useEffect(() => { aiPendingRef.current = processAI.isPending; }, [processAI.isPending]);

  const [liveExtraction, setLiveExtraction] = useState<Extraction | null>(null);
  useEffect(() => {
    setLiveExtraction(record?.extraction ? ensureExtractionShape(record.extraction) : null);
  }, [record?.id, record?.extraction]);

  const conductorLabel = useMemo(
    () => (record ? getRecordConductorLabel(record, liveExtraction) : "—"),
    [record, liveExtraction]
  );

  const [selectedImageId, setSelectedImageId] = useState<string>("");
  const [highlightedBbox, setHighlightedBbox] = useState<Bbox | null>(null);
  const [hoverBboxEnabled, setHoverBboxEnabled] = useState(true);
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibration, setCalibration] = useState<BboxCalibration>(DEFAULT_CALIBRATION);
  const [detectedFormat, setDetectedFormat] = useState<BboxFormat>("norm-1000");
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null);
  const [editingBboxId, setEditingBboxId] = useState<string | null>(null);
  const [pendingBboxSetter, setPendingBboxSetter] = useState<((bbox: Bbox) => void) | null>(null);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "b" && !e.ctrlKey && !e.metaKey) { setHoverBboxEnabled(v => !v); e.preventDefault(); }
      if (e.key === "c" && !e.ctrlKey && !e.metaKey) { setCalibrationMode(v => !v); e.preventDefault(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const requestBboxEdit = useCallback((id: string, setter: (bbox: Bbox) => void) => {
    setEditingBboxId(id);
    setPendingBboxSetter(() => setter);
    toast("Dibuja la caja sobre la imagen", { description: "Click y arrastra para marcar la posición del campo." });
  }, []);

  const handleBboxDrawn = useCallback((bbox: Bbox) => {
    pendingBboxSetter?.(bbox);
    setEditingBboxId(null);
    setPendingBboxSetter(null);
    toast.success("Caja actualizada");
  }, [pendingBboxSetter]);

  const cancelBboxEdit = useCallback(() => { setEditingBboxId(null); setPendingBboxSetter(null); }, []);

  const handleHoverBbox = useCallback((bbox: Bbox | null) => { setHighlightedBbox(hoverBboxEnabled ? bbox : null); }, [hoverBboxEnabled]);

  const bboxEditContextValue = useMemo<BboxEditContextValue>(
    () => ({ activeId: editingBboxId, requestEdit: requestBboxEdit }),
    [editingBboxId, requestBboxEdit]
  );

  useEffect(() => {
    if (id) openRecord.mutate(id);
    return () => { if (id && !aiPendingRef.current) releaseRecord.mutate(id); };
  }, [id]);

  const fallbackImageId = record?.images[0]?.id;
  const effectiveSelectedId = selectedImageId && record?.images.some(i => i.id === selectedImageId) ? selectedImageId : (fallbackImageId ?? "");
  if (fallbackImageId && selectedImageId !== effectiveSelectedId && selectedImageId === "") {
    setSelectedImageId(effectiveSelectedId);
  }

  const recordExtraction = record?.extraction;
  const processedIds = useMemo(() => new Set(recordExtraction?._meta?.processedImageIds ?? []), [recordExtraction]);
  const overlays = useMemo(() => calibrationMode && recordExtraction ? collectOverlays(recordExtraction) : undefined, [calibrationMode, recordExtraction]);

  const handleMetricsChange = useCallback(({ detectedFormat: fmt, naturalWidth, naturalHeight }: { detectedFormat: BboxFormat; naturalWidth: number; naturalHeight: number }) => {
    setDetectedFormat(prev => prev === fmt ? prev : fmt);
    setImageSize(prev => prev?.w === naturalWidth && prev?.h === naturalHeight ? prev : { w: naturalWidth, h: naturalHeight });
    setCalibration(prev => {
      const untouched = prev.offsetX === 0 && prev.offsetY === 0 && prev.scaleX === 1 && prev.scaleY === 1;
      if (!untouched || prev.format === fmt) return prev;
      return { ...prev, format: fmt };
    });
  }, []);

  if (error) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-start gap-3 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Registro no disponible</h2>
        <p className="text-sm text-muted-foreground">{error instanceof Error ? error.message : "Error desconocido"}.</p>
        <Link href="/admin" className="inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-sm hover:bg-muted"><ArrowLeft className="size-4" />Volver al panel</Link>
      </div>
    );
  }

  if (isLoading || !record) {
    return <div className="flex h-64 items-center justify-center"><div className="skeleton h-8 w-48 rounded-lg" /></div>;
  }

  const gallery = (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {calibrationMode && <BboxCalibrator calibration={calibration} detectedFormat={detectedFormat} imageSize={imageSize} onChange={setCalibration} />}
      <div className="min-h-0 flex-1">
        <ImageGallery images={record.images} selectedId={effectiveSelectedId} onSelect={setSelectedImageId}
          processedIds={processedIds} highlightedBbox={highlightedBbox} overlays={overlays}
          calibration={calibrationMode ? calibration : undefined} onMetricsChange={handleMetricsChange}
          drawBboxMode={editingBboxId !== null} onBboxDrawn={handleBboxDrawn} onCancelDraw={cancelBboxEdit} />
      </div>
    </div>
  );

  return (
    <BboxEditContext.Provider value={bboxEditContextValue}>
      <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
        {/* ── Sticky toolbar ── */}
        <div className="sticky top-0 z-20 -mx-4 -mt-4 border-b bg-background/80 px-4 py-2.5 backdrop-blur-xl md:-mx-6 md:-mt-6 md:px-6 lg:-mx-8 lg:-mt-8 lg:px-8">
          <div className="flex flex-wrap items-center gap-2">
            {/* Left: nav + info */}
            <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
              <Link href="/admin" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <ArrowLeft className="size-4" />Volver
              </Link>
              <span className="hidden h-5 w-px bg-border sm:block" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{conductorLabel}</p>
                <p className="text-xs text-muted-foreground">{formatDate(record.createdAt)}</p>
              </div>
              <StatusBadge status={record.status} />
            </div>

            {/* Right: tool buttons */}
            <div className="flex items-center gap-1.5">
              {/* Image tools group */}
              <div className="flex items-center rounded-lg border bg-muted/30 p-0.5">
                <Button variant={hoverBboxEnabled ? "default" : "ghost"} size="sm" className="h-7 rounded-md px-2 text-xs"
                  onClick={() => { setHoverBboxEnabled(v => !v); setHighlightedBbox(null); }}
                  disabled={!record.extraction} title="Resaltar caja al pasar mouse (B)">
                  <Layers className="size-3.5" />
                  <span className="hidden sm:inline ml-1">{hoverBboxEnabled ? "Resaltado" : "Sin resaltar"}</span>
                </Button>
                <Button variant={calibrationMode ? "default" : "ghost"} size="sm" className="h-7 rounded-md px-2 text-xs"
                  onClick={() => setCalibrationMode(v => !v)} disabled={!record.extraction} title="Ver todas las cajas IA (C)">
                  <ScanLine className="size-3.5" />
                  <span className="hidden sm:inline ml-1">{calibrationMode ? "Cajas visibles" : "Cajas IA"}</span>
                </Button>
              </div>
              {/* Export group */}
              <div className="hidden sm:flex items-center gap-1">
                <PdfExportButton record={record} />
                <ExcelExportButton record={record} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Content area ── */}
        {isDesktop ? (
          <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1 rounded-xl border bg-card shadow-sm">
            <ResizablePanel defaultSize={55} minSize={35}>
              <div className="h-full overflow-auto p-3">{gallery}</div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={45} minSize={30}>
              <div className="h-full overflow-auto">
                <ExtractionPanel record={record} processAI={processAI} onHoverBbox={handleHoverBbox} onLiveExtractionChange={setLiveExtraction} />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <Tabs defaultValue="gallery" className="min-h-0 flex-1">
            <TabsList className="grid w-full grid-cols-2 rounded-xl">
              <TabsTrigger value="gallery" className="rounded-lg">Galería</TabsTrigger>
              <TabsTrigger value="data" className="rounded-lg">Datos</TabsTrigger>
            </TabsList>
            <TabsContent value="gallery" className="mt-3 min-h-0 flex-1">{gallery}</TabsContent>
            <TabsContent value="data" className="mt-3"><ExtractionPanel record={record} processAI={processAI} onHoverBbox={handleHoverBbox} onLiveExtractionChange={setLiveExtraction} /></TabsContent>
          </Tabs>
        )}
      </div>
    </BboxEditContext.Provider>
  );
}
