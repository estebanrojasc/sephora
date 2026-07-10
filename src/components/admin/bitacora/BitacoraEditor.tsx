"use client";

import { BitacoraDayList as BitacoraDayListShared } from "@/components/admin/bitacora/BitacoraDayList";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  FilePlus2,
  Loader2,
  Save,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BitacoraPasteZone } from "./BitacoraPasteZone";
import { BitacoraPreviewTable } from "./BitacoraPreviewTable";
import { BitacoraStepper } from "./BitacoraStepper";
import {
  gridToHeuristicRows,
  summarizeBitacoraRows,
} from "@/features/bitacora/heuristics";
import { parseClipboardToGrid } from "@/features/bitacora/parse-tsv";
import {
  useCreateBitacora,
  useCreateMissingRecordsFromBitacora,
  useCreateRecordFromBitacora,
  useParseBitacora,
  useUpdateBitacoraRow,
  useUpdateBitacoraRowSettings,
} from "@/features/bitacora/queries";
import { useRecords } from "@/features/records/queries";
import {
  collectBitacoraRowRecordLinks,
  getRowLinkedRecordIds,
  bitacoraRowNeedsOwnRecord,
} from "@/features/bitacora/row-links";
import { pickPendingDeliveryPatch } from "@/features/bitacora/row-patch";
import { bitacoraRecorridoCanonical } from "@/features/bitacora/meta";
import type { Bitacora, BitacoraRow } from "@/features/bitacora/types";
import { todayIsoDateChile } from "@/lib/date-utils";
import { focusAdminQueueOnBitacoraRecord, adminQueueUrlForBitacoraDay } from "@/lib/admin-session-storage";
import { notifyAdminSessionPrefsChanged } from "@/hooks/use-admin-session-prefs";
import { cn } from "@/lib/utils";

interface BitacoraEditorProps {
  initial?: Bitacora;
  readOnly?: boolean;
}

export function BitacoraEditor({ initial, readOnly = false }: BitacoraEditorProps) {
  const router = useRouter();
  const createBitacora = useCreateBitacora();
  const parseBitacora = useParseBitacora();
  const createRecord = useCreateRecordFromBitacora();
  const createMissing = useCreateMissingRecordsFromBitacora();
  const updateRowSettings = useUpdateBitacoraRowSettings();
  const updateBitacoraRow = useUpdateBitacoraRow();
  const { data: allRecords = [] } = useRecords({ status: "all", poll: false });

  const [step, setStep] = useState(initial ? 2 : 1);
  const [rawPaste, setRawPaste] = useState(initial?.rawPaste ?? "");
  const [date, setDate] = useState(initial?.date ?? todayIsoDateChile());
  const [title, setTitle] = useState(initial?.title ?? "");
  const [rows, setRows] = useState<BitacoraRow[]>(initial?.rows ?? []);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [creatingRowId, setCreatingRowId] = useState<string | null>(null);
  const [parsed, setParsed] = useState(Boolean(initial?.rows.length));
  /** Último pegado parseado; evita reparsear al volver del paso Revisar. */
  const [parsedFromPaste, setParsedFromPaste] = useState<string | null>(
    initial?.rawPaste?.trim() ? initial.rawPaste : null
  );

  const summary = useMemo(() => summarizeBitacoraRows(rows), [rows]);

  useEffect(() => {
    if (!initial) return;
    setRows(initial.rows ?? []);
    setRawPaste(initial.rawPaste ?? "");
    setDate(initial.date);
    setTitle(initial.title ?? "");
    setParsed(Boolean(initial.rows?.length));
    setParsedFromPaste(initial.rawPaste?.trim() ? initial.rawPaste : null);
    setStep(2);
  }, [initial?.id]);

  const rowRecordLinks = useMemo(() => {
    if (!initial) return undefined;
    return collectBitacoraRowRecordLinks({ ...initial, rows }, allRecords);
  }, [initial, rows, allRecords]);

  const rowsNeedingRecord = useMemo(() => {
    if (!rowRecordLinks) return [];
    return rows.filter((row) =>
      bitacoraRowNeedsOwnRecord(row, rowRecordLinks.get(row.id) ?? [])
    );
  }, [rows, rowRecordLinks]);

  const applyHeuristic = useCallback((raw: string) => {
    const grid = parseClipboardToGrid(raw);
    const h = gridToHeuristicRows(grid);
    setRows(h.rows);
    if (h.date) setDate(h.date);
    if (h.title) setTitle(h.title);
    setWarnings(h.warnings);
    setParsed(h.rows.length > 0);
    setParsedFromPaste(raw);
    return h;
  }, []);

  const handlePaste = useCallback(
    (raw: string) => {
      const h = applyHeuristic(raw);
      if (h.rows.length > 0) {
        setStep(2);
        toast.success(`${h.rows.length} filas detectadas — revisa antes de guardar`);
      }
    },
    [applyHeuristic]
  );

  const goToReview = () => {
    if (!rawPaste.trim()) {
      toast.error("Pega la tabla de Excel primero");
      return;
    }
    const pasteChanged = parsedFromPaste !== rawPaste;
    if (pasteChanged || rows.length === 0) {
      const h = applyHeuristic(rawPaste);
      if (h.rows.length === 0) {
        toast.error("No se detectaron filas. Verifica el contenido pegado.");
        return;
      }
    }
    setStep(2);
  };

  const handleRefineWithAI = async () => {
    if (!rawPaste.trim()) return;
    try {
      const result = await parseBitacora.mutateAsync({
        rawPaste,
        useAi: true,
      });
      setRows(result.rows);
      if (result.date) setDate(result.date);
      if (result.title) setTitle(result.title);
      const providerLabel =
        (result as { provider?: string }).provider === "heuristic"
          ? "heurísticas (IA no disponible)"
          : ((result as { provider?: string }).provider ?? "IA");
      setWarnings([
        ...(result.warnings ?? []),
        `Estructurado con ${providerLabel} — revisa las filas antes de guardar.`,
      ]);
      setParsed(true);
      toast.success("IA aplicada. Revisa los cambios en la tabla.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al refinar con IA");
    }
  };

  const handleSave = async () => {
    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      toast.error("Fecha inválida");
      return;
    }
    const dataRows = rows.filter((r) => r.rowType !== "totals");
    if (dataRows.length === 0) {
      toast.error("No hay filas de datos para guardar");
      return;
    }
    try {
      const saved = await createBitacora.mutateAsync({
        date,
        title: title || undefined,
        rows,
        rawPaste,
      });
      toast.success(`Bitácora guardada (v${saved.version})`);
      router.push(`/admin/bitacora/${saved.date}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    }
  };

  const handleCreateRecord = async (row: BitacoraRow) => {
    if (!initial?.id) {
      toast.error("Guarda la bitácora antes de crear registros");
      return;
    }

    const current = rows.find((r) => r.id === row.id) ?? row;

    if (current.rowType === "entrega_pendiente") {
      if (!current.scheduledDate?.trim()) {
        toast.error(
          "Indica la fecha programada en la columna «Fecha prog.» antes de crear el registro"
        );
        return;
      }
    }

    setCreatingRowId(row.id);
    try {
      if (current.rowType === "entrega_pendiente") {
        await updateBitacoraRow.mutateAsync({
          bitacoraId: initial.id,
          rowId: current.id,
          ...pickPendingDeliveryPatch(current),
        });
      }

      const { recordId } = await createRecord.mutateAsync({
        bitacoraId: initial.id,
        rowId: current.id,
      });
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== row.id) return r;
          const linkedRecordIds = [...getRowLinkedRecordIds(r), recordId];
          return {
            ...r,
            linkedRecordId: linkedRecordIds[0],
            linkedRecordIds,
          };
        })
      );
      const queueDay =
        current.rowType === "entrega_pendiente" && current.scheduledDate
          ? current.scheduledDate
          : initial.date;
      focusAdminQueueOnBitacoraRecord(queueDay);
      notifyAdminSessionPrefsChanged();
      toast.success("Registro creado · ya está en Guardados");
      router.push(adminQueueUrlForBitacoraDay(queueDay));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al crear registro");
    } finally {
      setCreatingRowId(null);
    }
  };

  const handleCreateMissingRecords = async () => {
    if (!initial?.id || rowsNeedingRecord.length === 0) return;
    try {
      const result = await createMissing.mutateAsync({
        bitacoraId: initial.id,
      });
      focusAdminQueueOnBitacoraRecord(initial.date);
      notifyAdminSessionPrefsChanged();
      if (result.created > 0) {
        toast.success(
          `${result.created} registro(s) creados · mira el ${initial.date} con Fecha recorrido`
        );
        router.push(adminQueueUrlForBitacoraDay(initial.date));
        return;
      }
      if (result.failures.length > 0) {
        toast.error(
          result.failures
            .slice(0, 3)
            .map((f) => `${f.recorrido}: ${f.message}`)
            .join(" · ")
        );
      } else {
        toast.message("No había registros pendientes por crear");
      }
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudieron crear los registros"
      );
    }
  };

  const missingRecordsBanner =
    initial && rowsNeedingRecord.length > 0 ? (
      <div className="flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Faltan {rowsNeedingRecord.length} en la cola:{" "}
          <strong>
            {rowsNeedingRecord
              .map((r) => bitacoraRecorridoCanonical(r) || "?")
              .join(", ")}
          </strong>
        </p>
        <Button
          type="button"
          size="sm"
          className="shrink-0 gap-2"
          disabled={createMissing.isPending || creatingRowId != null}
          onClick={() => void handleCreateMissingRecords()}
        >
          {createMissing.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FilePlus2 className="size-4" />
          )}
          Crear y ir a la cola
        </Button>
      </div>
    ) : null;

  const handleToggleMultipleReviews = async (
    rowId: string,
    allowsMultipleReviews: boolean
  ) => {
    if (!initial?.id) return;
    try {
      await updateRowSettings.mutateAsync({
        bitacoraId: initial.id,
        rowId,
        allowsMultipleReviews,
      });
      setRows((prev) =>
        prev.map((r) =>
          r.id === rowId ? { ...r, allowsMultipleReviews } : r
        )
      );
      toast.success(
        allowsMultipleReviews
          ? "Esta fila admite varias revisiones"
          : "Solo una revisión por fila"
      );
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No se pudo actualizar la fila"
      );
    }
  };

  if (readOnly && initial) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Fecha bitácora</Label>
            <Input type="date" value={initial.date} disabled />
          </div>
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={initial.title ?? ""} disabled />
          </div>
        </div>
        {missingRecordsBanner}
        <BitacoraPreviewTable
          rows={rows}
          onChange={setRows}
          readOnly
          onCreateRecord={handleCreateRecord}
          creatingRowId={creatingRowId}
          rowRecordLinks={rowRecordLinks}
          onToggleMultipleReviews={handleToggleMultipleReviews}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BitacoraStepper currentStep={step} />

      {step === 1 && (
        <div className="space-y-6">
          <BitacoraPasteZone
            value={rawPaste}
            onChange={setRawPaste}
            onPaste={handlePaste}
          />
          <div className="flex justify-end">
            <Button type="button" onClick={goToReview} disabled={!rawPaste.trim()}>
              Continuar
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          {warnings.length > 0 && (
            <Alert>
              <AlertDescription className="space-y-1 text-xs">
                {warnings.map((w) => (
                  <div key={w}>{w}</div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Fecha bitácora</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="BITÁCORA CL20 A …"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-muted px-2 py-0.5">
              {summary.rutas} rutas
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5">
              {summary.pendientes} pendientes
            </span>
            <span className="rounded-full bg-muted px-2 py-0.5">
              {summary.manuales} manuales
            </span>
            {summary.desconocidas > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                {summary.desconocidas} sin clasificar
              </span>
            )}
            {summary.totales > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5">
                {summary.totales} fila totales
              </span>
            )}
          </div>

          <BitacoraPreviewTable rows={rows} onChange={setRows} />

          <div className="rounded-lg border border-dashed p-3">
            <p className="text-xs text-muted-foreground">
              El parseo local cubre la bitácora habitual. Usa Gemini (mismo
              proveedor que el reconocimiento) solo si alguna fila quedó mal
              clasificada.
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 h-8 gap-1.5 text-xs"
              onClick={handleRefineWithAI}
              disabled={parseBitacora.isPending}
            >
              {parseBitacora.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Brain className="size-3.5" />
              )}
              Refinar con IA (opcional)
            </Button>
          </div>

          <div className="flex justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
            >
              <ArrowLeft className="size-4" />
              Volver a pegar
            </Button>
            <Button
              type="button"
              onClick={() => setStep(3)}
              disabled={!parsed || summary.total === 0}
            >
              Continuar a guardar
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumen antes de guardar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Fecha:</span>{" "}
                  <strong>{date}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Título:</span>{" "}
                  <strong>{title || "—"}</strong>
                </p>
              </div>
              <ul className="list-inside list-disc text-muted-foreground">
                <li>{summary.rutas} rutas del día</li>
                <li>{summary.pendientes} entregas pendientes (otras fechas)</li>
                <li>{summary.manuales} ingresos manuales</li>
                {summary.totales > 0 && <li>{summary.totales} fila de totales</li>}
              </ul>
              <p className="text-xs text-muted-foreground">
                Se creará una nueva versión activa para este día. La versión
                anterior quedará en el historial.
              </p>
            </CardContent>
          </Card>

          <div className="flex justify-between gap-2">
            <Button type="button" variant="outline" onClick={() => setStep(2)}>
              <ArrowLeft className="size-4" />
              Volver a revisar
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={createBitacora.isPending}
              className={cn("gap-2")}
            >
              {createBitacora.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              Guardar bitácora
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function BitacoraVersionSelector({
  versions,
  selectedId,
  onSelect,
}: {
  versions: Bitacora[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-xs">Versión</Label>
      <Select
        value={selectedId}
        onValueChange={(v) => {
          if (v) onSelect(v);
        }}
      >
        <SelectTrigger className="h-8 w-[220px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {versions.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              v{v.version}
              {v.isActive ? " (activa)" : ""} —{" "}
              {new Date(v.createdAt).toLocaleString("es-CL")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function BitacoraDayList({ dates }: { dates: string[] }) {
  return <BitacoraDayListShared dates={dates} />;
}
