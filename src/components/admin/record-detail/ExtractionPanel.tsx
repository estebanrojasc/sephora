"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Brain,
  History,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProcessAIButton } from "./ProcessAIButton";
import {
  ExtractionForm,
  type ExtractionFormHandle,
} from "./ExtractionForm";
import { ActionBar } from "./ActionBar";
import { RawResponseDialog } from "./RawResponseDialog";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { COPY } from "@/lib/constants";
import type {
  Bbox,
  Extraction,
  Record,
} from "@/features/records/types";
import { ensureExtractionShape } from "@/features/records/types";
import {
  useProcessAI,
  useUpdateExtraction,
  useUpdateStatus,
} from "@/features/records/mutations";
import { getTotalFieldIssues, getTotalsStatus } from "@/features/records/totals";
import { formatCLP } from "@/lib/parse-number";
import { toast } from "sonner";

interface ExtractionPanelProps {
  record: Record;
  onHoverBbox?: (bbox: Bbox | null) => void;
  /** Sincroniza cabecera/listados con ediciones locales del formulario. */
  onLiveExtractionChange?: (extraction: Extraction | null) => void;
}

export function ExtractionPanel({
  record,
  onHoverBbox,
  onLiveExtractionChange,
}: ExtractionPanelProps) {
  const processAI = useProcessAI();
  const updateExtraction = useUpdateExtraction();
  const updateStatus = useUpdateStatus();

  const formRef = useRef<ExtractionFormHandle>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [errorsOpen, setErrorsOpen] = useState(false);
  const [errorComment, setErrorComment] = useState("");
  const [liveExtraction, setLiveExtraction] = useState<Extraction | null>(() =>
    record.extraction ? ensureExtractionShape(record.extraction) : null
  );

  const handleFormStateChange = useCallback(
    (next: Extraction) => {
      setLiveExtraction(next);
      onLiveExtractionChange?.(next);
    },
    [onLiveExtractionChange]
  );

  useEffect(() => {
    const next = record.extraction
      ? ensureExtractionShape(record.extraction)
      : null;
    setLiveExtraction(next);
    onLiveExtractionChange?.(next);
  }, [record.extraction, record.id, onLiveExtractionChange]);

  const totalsStatus = useMemo(
    () => (liveExtraction ? getTotalsStatus(liveExtraction) : null),
    [liveExtraction]
  );

  const totalFieldIssues = useMemo(
    () => (totalsStatus ? getTotalFieldIssues(totalsStatus) : undefined),
    [totalsStatus]
  );

  const processedSet = useMemo(
    () => new Set(record.extraction?._meta?.processedImageIds ?? []),
    [record.extraction?._meta?.processedImageIds]
  );

  const hasExtraction = !!record.extraction;
  const totalImages = record.images.length;
  const attemptCount = record.attemptCount ?? 0;

  const runProcessAI = (reset = false) => {
    processAI.mutate(
      {
        id: record.id,
        payload: { reset },
      },
      {
        onSuccess: () => {
          toast.success(
            reset ? "Extracción reemplazada" : "Extracción completada"
          );
          setResetOpen(false);
        },
        onError: (err) =>
          toast.error(err.message || "Error al procesar con IA"),
      }
    );
  };

  const persistExtraction = async () => {
    const values = formRef.current?.getValues();
    if (!values) return;
    await updateExtraction.mutateAsync({ id: record.id, payload: values });
  };

  const handleSave = async () => {
    try {
      if (record.extraction) await persistExtraction();
      await updateStatus.mutateAsync({
        id: record.id,
        payload: { status: "saved" },
      });
      toast.success("Registro guardado");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar");
    }
  };

  const handleReject = async () => {
    try {
      await updateStatus.mutateAsync({
        id: record.id,
        payload: { status: "rejected" },
      });
      toast.success("Registro rechazado");
    } catch {
      toast.error("No se pudo rechazar");
    }
  };

  const handleMarkErrors = async () => {
    try {
      await updateStatus.mutateAsync({
        id: record.id,
        payload: {
          status: "errors",
          errorComment:
            errorComment ||
            "Documento ilegible o incompleto. Por favor vuelva a capturar.",
        },
      });
      setErrorsOpen(false);
      toast.success("Registro marcado con errores");
    } catch {
      toast.error("No se pudo actualizar el estado");
    }
  };

  const loading =
    processAI.isPending ||
    updateExtraction.isPending ||
    updateStatus.isPending;

  return (
    <div className="flex h-full flex-col gap-4">
      {!hasExtraction ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-gradient-to-br from-indigo-50/40 to-violet-50/40 p-8 text-center dark:from-indigo-950/20 dark:to-violet-950/20">
          <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 p-3 text-white shadow-md">
            <Brain className="size-7" />
          </div>
          <p className="max-w-sm text-sm text-muted-foreground">
            {COPY.admin.noExtraction}
          </p>
          <p className="text-xs text-muted-foreground">
            Se procesarán las{" "}
            <span className="font-semibold text-foreground">
              {totalImages} hoja{totalImages === 1 ? "" : "s"}
            </span>{" "}
            del documento en una sola corrida.
          </p>
          <ProcessAIButton
            onClick={() => runProcessAI(false)}
            loading={processAI.isPending}
            imageCount={totalImages}
          />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="gap-1 border-indigo-200 bg-indigo-50 text-xs text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200"
            >
              <History className="size-3" />
              {attemptCount} corrida{attemptCount === 1 ? "" : "s"} ·{" "}
              {processedSet.size}/{totalImages} hojas
            </Badge>
            {record.extraction?._meta?.source === "mock" && (
              <Badge variant="outline" className="text-xs">
                Modo simulado (sin API key)
              </Badge>
            )}
            {record.extraction?._meta?.lastProvider &&
              record.extraction._meta.lastProvider !== "mock" && (
                <Badge
                  variant="outline"
                  className="border-violet-200 bg-violet-50 text-xs uppercase text-violet-700 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-200"
                >
                  {record.extraction._meta.lastProvider}
                  {record.extraction._meta.lastModel
                    ? ` · ${record.extraction._meta.lastModel}`
                    : ""}
                </Badge>
              )}
            {record.extraction?._meta?.lastWithBboxes === false && (
              <Badge variant="outline" className="text-xs">
                Sin bboxes IA
              </Badge>
            )}
            <div className="ml-auto">
              <RawResponseDialog
                raw={record.extraction?._meta?.lastRawResponse}
                model={record.extraction?._meta?.lastModel}
                source={record.extraction?._meta?.source}
                withBboxes={record.extraction?._meta?.lastWithBboxes}
              />
            </div>
          </div>

          <ExtractionForm
            extraction={record.extraction!}
            formRef={formRef}
            onHoverBbox={onHoverBbox}
            onStateChange={handleFormStateChange}
            totalFieldIssues={totalFieldIssues}
          />

          {totalsStatus && totalsStatus.missing.length > 0 && (
            <Alert variant="destructive">
              <AlertTriangle className="size-4" />
              <AlertDescription>
                <p className="font-medium">
                  Faltan totales por completar antes de guardar:
                </p>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {totalsStatus.missing.map((m) => (
                    <li key={m.id}>
                      {m.label} ·{" "}
                      <span className="font-mono">
                        suma de filas: {formatCLP(m.sumItems)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-xs text-muted-foreground">
                  Escribe el total que aparece en el documento (o usa la suma
                  calculada como referencia).
                </p>
              </AlertDescription>
            </Alert>
          )}

          {totalsStatus &&
            totalsStatus.missing.length === 0 &&
            totalsStatus.mismatches.length > 0 && (
              <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100 [&>svg]:text-amber-700 dark:[&>svg]:text-amber-300">
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  <p className="font-medium">
                    Hay descuadre entre los totales y la suma de filas:
                  </p>
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {totalsStatus.mismatches.map((m) => (
                      <li key={m.id}>
                        {m.label} · declarado{" "}
                        <span className="font-mono">
                          {formatCLP(m.declared ?? 0)}
                        </span>{" "}
                        vs suma{" "}
                        <span className="font-mono">
                          {formatCLP(m.sumItems)}
                        </span>{" "}
                        · Δ{" "}
                        <span className="font-mono font-semibold">
                          {formatCLP(Math.abs(m.diff ?? 0))}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1 text-xs">
                    Puedes guardar igual; el descuadre quedará anotado en el
                    reporte ejecutivo.
                  </p>
                </AlertDescription>
              </Alert>
            )}

          <div className="space-y-2">
            <ProcessAIButton
              onClick={() => runProcessAI(false)}
              loading={processAI.isPending}
              isAddingToExisting
              imageCount={totalImages}
            />
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setResetOpen(true)}
              disabled={loading}
            >
              <RotateCcw className="size-4" />
              Reiniciar extracción desde cero
            </Button>
          </div>
        </>
      )}

      {record.errorComment && (
        <Alert variant="destructive">
          <AlertDescription>{record.errorComment}</AlertDescription>
        </Alert>
      )}

      <ActionBar
        onSave={handleSave}
        onMarkErrors={() => setErrorsOpen(true)}
        onReject={handleReject}
        loading={loading}
        saveDisabled={Boolean(totalsStatus && !totalsStatus.canSave)}
        saveDisabledReason={
          totalsStatus && !totalsStatus.canSave
            ? `Faltan totales: ${totalsStatus.missing
                .map((m) => m.label)
                .join(", ")}`
            : undefined
        }
      />

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="¿Reiniciar extracción?"
        description="Se descartarán todos los datos extraídos y se procesarán todas las hojas desde cero. La extracción anterior queda en el historial."
        confirmLabel="Sí, reiniciar"
        variant="destructive"
        onConfirm={() => runProcessAI(true)}
        loading={processAI.isPending}
      />

      <Dialog
        open={errorsOpen}
        onOpenChange={(next) => {
          if (updateStatus.isPending && !next) return;
          setErrorsOpen(next);
        }}
      >
        <DialogContent showCloseButton={!updateStatus.isPending}>
          <DialogHeader>
            <DialogTitle>Marcar con errores</DialogTitle>
            <DialogDescription>
              El conductor verá este comentario.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="errorComment">Comentario para el conductor</Label>
            <Textarea
              id="errorComment"
              value={errorComment}
              onChange={(e) => setErrorComment(e.target.value)}
              placeholder="Ej: La foto está borrosa, no se lee la fecha."
              disabled={updateStatus.isPending}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setErrorsOpen(false)}
              disabled={updateStatus.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleMarkErrors}
              disabled={updateStatus.isPending}
              className="gap-2"
            >
              {updateStatus.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {updateStatus.isPending ? "Guardando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
