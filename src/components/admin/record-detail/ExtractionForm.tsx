"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
  type Ref,
} from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FieldInput } from "./FieldInput";
import { RowsEditor } from "./RowsEditor";
import { ComputedTotal } from "./ComputedTotal";
import { Textarea } from "@/components/ui/textarea";
import {
  ensureExtractionShape,
  type Bbox,
  type BilleteRow,
  type ChequeRow,
  type ExtractedField,
  type Extraction,
  type NCRow,
  type TransferenciaRow,
  type CreditoVendedorRow,
} from "@/features/records/types";
import type { BitacoraExcelFields, BitacoraMetaBlock } from "@/features/bitacora/meta";
import {
  applyAllBitacoraSuggested,
  BITACORA_TO_EXTRACTION,
  markBitacoraFieldApplied,
  syncBitacoraMetaInExtraction,
} from "@/features/bitacora/meta";
import type { TotalFieldIssue } from "@/features/records/totals";
import { isChequeAlDia, chequeReferenceIso } from "@/features/records/cheque-utils";
import { syncDetalleEfectivoTotals } from "@/features/records/efectivo-totals";
import { formatCLP, parseNumber } from "@/lib/parse-number";

const EMPTY: ExtractedField = { valor: "", bbox: [0, 0, 0, 0] };

function withBitacoraMeta(
  extraction: Extraction,
  bitacora: BitacoraMetaBlock
): Extraction {
  return {
    ...extraction,
    _meta: {
      confidence: extraction._meta?.confidence ?? 0,
      processedImageIds: extraction._meta?.processedImageIds ?? [],
      processedAt: extraction._meta?.processedAt ?? new Date().toISOString(),
      manualOverride: extraction._meta?.manualOverride,
      source: extraction._meta?.source,
      lastRawResponse: extraction._meta?.lastRawResponse,
      lastModel: extraction._meta?.lastModel,
      lastProvider: extraction._meta?.lastProvider,
      lastWithBboxes: extraction._meta?.lastWithBboxes,
      bitacora,
    },
  };
}

const newCheque = (): ChequeRow => ({
  fecha: { ...EMPTY },
  banco: { ...EMPTY },
  valor: { ...EMPTY },
});
const newNc = (): NCRow => ({
  no_fac: { ...EMPTY },
  valor: { ...EMPTY },
});
const newTransferencia = (): TransferenciaRow => ({
  no_fac: { ...EMPTY },
  valor: { ...EMPTY },
  cliente: { ...EMPTY },
  banco: { ...EMPTY },
});
const newCreditoVendedor = (): CreditoVendedorRow => ({
  no_fac: { ...EMPTY },
  valor: { ...EMPTY },
  cliente: { ...EMPTY },
  nro_vendedor: { ...EMPTY },
});
const newBillete = (): BilleteRow => ({
  denominacion: { ...EMPTY },
  valor: { ...EMPTY },
});

export interface ExtractionFormHandle {
  getValues: () => Extraction;
  applyScalarField: (key: keyof Extraction, value: string) => void;
  applyBitacoraField: (
    field: keyof BitacoraExcelFields,
    value: string,
    initialMeta?: BitacoraMetaBlock
  ) => void;
  applyAllBitacora: (initialMeta?: BitacoraMetaBlock) => void;
  setBitacoraMeta: (meta: BitacoraMetaBlock) => void;
}

interface ExtractionFormProps {
  extraction: Extraction;
  formRef?: Ref<ExtractionFormHandle>;
  onHoverBbox?: (bbox: Bbox | null) => void;
  /**
   * Notificación al padre de cualquier edición local del formulario. Se usa
   * para validar totales y descuadres en tiempo real desde fuera (botón
   * Guardar, alertas, etc.).
   */
  onStateChange?: (extraction: Extraction) => void;
  /** Campos de total a resaltar (falta o descuadre). */
  totalFieldIssues?: Map<string, TotalFieldIssue>;
}

export function ExtractionForm({
  extraction,
  formRef,
  onHoverBbox,
  onStateChange,
  totalFieldIssues,
}: ExtractionFormProps) {
  // Estado local editable. Cuando la prop `extraction` cambia (porque la IA
  // devolvió una nueva extracción o porque se cargó otro registro), lo
  // sincronizamos *durante el render* en vez de un useEffect, evitando el
  // warning de set-state-in-effect.
  const [state, setState] = useState<Extraction>(() =>
    ensureExtractionShape(extraction)
  );
  const [lastExternal, setLastExternal] = useState<Extraction>(extraction);
  if (lastExternal !== extraction) {
    setLastExternal(extraction);
    setState(ensureExtractionShape(extraction));
  }

  const chequeRef = useMemo(() => chequeReferenceIso(state), [state.fecha]);

  useImperativeHandle(
    formRef,
    () => ({
      getValues: () => syncBitacoraMetaInExtraction(state),
      applyScalarField: (key, value) => {
        setState((s) => {
          const current = s[key];
          if (
            !current ||
            typeof current !== "object" ||
            !("valor" in current)
          ) {
            return s;
          }
          return {
            ...s,
            [key]: { ...(current as ExtractedField), valor: value },
          };
        });
      },
      applyBitacoraField: (field, value, initialMeta) => {
        setState((s) => {
          const baseMeta = s._meta?.bitacora ?? initialMeta;
          if (!baseMeta) return s;

          const extractionKey = BITACORA_TO_EXTRACTION[field];
          let next: Extraction = { ...s };
          if (extractionKey) {
            const current = next[extractionKey];
            if (
              current &&
              typeof current === "object" &&
              "valor" in current
            ) {
              next = {
                ...next,
                [extractionKey]: {
                  ...(current as ExtractedField),
                  valor: value,
                },
              };
            }
          }
          const bitacora = markBitacoraFieldApplied(baseMeta, field, value);
          if (!bitacora) return next;
          return syncBitacoraMetaInExtraction(withBitacoraMeta(next, bitacora));
        });
      },
      applyAllBitacora: (initialMeta) => {
        setState((s) => {
          const baseMeta = s._meta?.bitacora ?? initialMeta;
          if (!baseMeta) return s;
          const bitacora = applyAllBitacoraSuggested(baseMeta);
          if (!bitacora) return s;
          let next: Extraction = withBitacoraMeta(s, bitacora);
          for (const [bitKey, extractionKey] of Object.entries(
            BITACORA_TO_EXTRACTION
          ) as [keyof BitacoraExcelFields, keyof Extraction][]) {
            const value = bitacora.excel[bitKey];
            if (!value || !extractionKey) continue;
            const current = next[extractionKey];
            if (
              current &&
              typeof current === "object" &&
              "valor" in current
            ) {
              next = {
                ...next,
                [extractionKey]: {
                  ...(current as ExtractedField),
                  valor: value,
                },
              };
            }
          }
          return syncBitacoraMetaInExtraction(next);
        });
      },
      setBitacoraMeta: (meta) => {
        setState((s) =>
          syncBitacoraMetaInExtraction(withBitacoraMeta(s, meta))
        );
      },
    }),
    [state]
  );

  useEffect(() => {
    onStateChange?.(state);
  }, [state, onStateChange]);

  const setField = useCallback(
    (key: keyof Extraction) => (val: ExtractedField) =>
      setState((s) => ({ ...s, [key]: val })),
    []
  );

  const setRendField = useCallback(
    (key: keyof Extraction["rendicion"]) => (val: ExtractedField) =>
      setState((s) => ({
        ...s,
        rendicion: { ...s.rendicion, [key]: val },
      })),
    []
  );

  const patchDetalleEfectivo = useCallback(
    (patch: Partial<Extraction["detalle_efectivo"]>) =>
      setState((s) =>
        syncDetalleEfectivoTotals({
          ...s,
          detalle_efectivo: { ...s.detalle_efectivo, ...patch },
        })
      ),
    []
  );

  const fieldHighlight = (editKey?: string) =>
    editKey ? totalFieldIssues?.get(editKey) : undefined;

  return (
    <div className="space-y-4">
      <Accordion multiple defaultValue={["header", "rendicion"]}>
        <AccordionItem value="header">
          <AccordionTrigger className="text-sm font-semibold">
            Encabezado
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldInput
                editKey="fecha"
                label="Fecha"
                type="date"
                value={state.fecha}
                onChange={setField("fecha")}
                onHover={onHoverBbox}
              />
              <FieldInput
                editKey="conductor"
                catalogKey="conductor"
                label="Conductor"
                value={state.conductor}
                onChange={setField("conductor")}
                onHover={onHoverBbox}
              />
              <FieldInput
                editKey="auxiliar"
                catalogKey="auxiliar"
                label="Auxiliar"
                value={state.auxiliar}
                onChange={setField("auxiliar")}
                onHover={onHoverBbox}
              />
              <FieldInput
                editKey="n_recorrido"
                catalogKey="n_recorrido"
                label="N° recorrido"
                value={state.n_recorrido}
                onChange={setField("n_recorrido")}
                onHover={onHoverBbox}
              />
              <FieldInput
                editKey="patente"
                catalogKey="patente"
                label="Patente"
                value={state.patente}
                onChange={setField("patente")}
                onHover={onHoverBbox}
              />
              <FieldInput
                editKey="cant_fact"
                label="Cant. fact."
                value={state.cant_fact}
                onChange={setField("cant_fact")}
                onHover={onHoverBbox}
              />
              <FieldInput
                editKey="valor_total"
                label="Valor total"
                value={state.valor_total}
                onChange={setField("valor_total")}
                onHover={onHoverBbox}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="rendicion">
          <AccordionTrigger className="text-sm font-semibold">
            Rendición
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldInput
                editKey="rendicion.efectivo_total"
                label="Efectivo total"
                value={state.rendicion.efectivo_total}
                onChange={setRendField("efectivo_total")}
                onHover={onHoverBbox}
                highlight={fieldHighlight("rendicion.efectivo_total")}
              />
              <FieldInput
                editKey="rendicion.cheques_al_dia"
                label="Cheques al día"
                value={state.rendicion.cheques_al_dia}
                onChange={setRendField("cheques_al_dia")}
                onHover={onHoverBbox}
              />
              <FieldInput
                editKey="rendicion.cheques_a_fecha"
                label="Cheques a fecha"
                value={state.rendicion.cheques_a_fecha}
                onChange={setRendField("cheques_a_fecha")}
                onHover={onHoverBbox}
              />
              <FieldInput
                editKey="rendicion.credito_vendedor"
                label="Crédito vendedor"
                value={state.rendicion.credito_vendedor}
                onChange={setRendField("credito_vendedor")}
                onHover={onHoverBbox}
                highlight={fieldHighlight("rendicion.credito_vendedor")}
              />
              <FieldInput
                editKey="rendicion.retorno_total"
                label="Retorno total"
                value={state.rendicion.retorno_total}
                onChange={setRendField("retorno_total")}
                onHover={onHoverBbox}
                highlight={fieldHighlight("rendicion.retorno_total")}
              />
              <FieldInput
                editKey="rendicion.retorno_parcial"
                label="Retorno parcial"
                value={state.rendicion.retorno_parcial}
                onChange={setRendField("retorno_parcial")}
                onHover={onHoverBbox}
                highlight={fieldHighlight("rendicion.retorno_parcial")}
              />
              <FieldInput
                editKey="rendicion.n_c_negocio"
                label="N/C negocio"
                value={state.rendicion.n_c_negocio}
                onChange={setRendField("n_c_negocio")}
                onHover={onHoverBbox}
              />
              <FieldInput
                editKey="rendicion.transferencia"
                label="Transferencia"
                value={state.rendicion.transferencia}
                onChange={setRendField("transferencia")}
                onHover={onHoverBbox}
              />
              <FieldInput
                editKey="rendicion.total"
                label="Total"
                value={state.rendicion.total}
                onChange={setRendField("total")}
                onHover={onHoverBbox}
                className="sm:col-span-2"
              />
            </div>
            <div className="mt-3">
              <ComputedTotal
                values={[
                  state.rendicion.efectivo_total.valor,
                  state.rendicion.cheques_al_dia.valor,
                  state.rendicion.cheques_a_fecha.valor,
                  state.rendicion.credito_vendedor.valor,
                  state.rendicion.retorno_total.valor,
                  state.rendicion.retorno_parcial.valor,
                  state.rendicion.n_c_negocio.valor,
                  state.rendicion.transferencia.valor,
                ]}
                extractedValue={state.rendicion.total.valor}
              />
            </div>

            <div className="mt-6 space-y-4 border-t pt-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Nulos (rechazo total)
                </p>
                <RowsEditor
                  rows={state.n_c_rechazo_total}
                  columns={[
                    {
                      key: "no_fac",
                      label: "N° factura",
                      catalogKey: "n_c_rechazo_total.no_fac",
                    },
                    { key: "valor", label: "Valor" },
                  ]}
                  createEmpty={newNc}
                  onChange={(rows) =>
                    setState((s) => ({ ...s, n_c_rechazo_total: rows }))
                  }
                  onHoverBbox={onHoverBbox}
                />
                <FieldInput
                  editKey="total_n_c_rechazo_total"
                  label="Total nulos"
                  value={state.total_n_c_rechazo_total}
                  onChange={setField("total_n_c_rechazo_total")}
                  onHover={onHoverBbox}
                  highlight={fieldHighlight("total_n_c_rechazo_total")}
                />
                <ComputedTotal
                  values={state.n_c_rechazo_total.map((r) => r.valor.valor)}
                  extractedValue={
                    state.total_n_c_rechazo_total.valor ||
                    state.rendicion.retorno_total.valor
                  }
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase text-muted-foreground">
                  Parciales (rechazo parcial)
                </p>
                <RowsEditor
                  rows={state.n_c_rechazo_parcial}
                  columns={[
                    {
                      key: "no_fac",
                      label: "N° factura",
                      catalogKey: "n_c_rechazo_parcial.no_fac",
                    },
                    { key: "valor", label: "Valor" },
                  ]}
                  createEmpty={newNc}
                  onChange={(rows) =>
                    setState((s) => ({ ...s, n_c_rechazo_parcial: rows }))
                  }
                  onHoverBbox={onHoverBbox}
                />
                <FieldInput
                  editKey="total_n_c_rechazo_parcial"
                  label="Total parciales"
                  value={state.total_n_c_rechazo_parcial}
                  onChange={setField("total_n_c_rechazo_parcial")}
                  onHover={onHoverBbox}
                  highlight={fieldHighlight("total_n_c_rechazo_parcial")}
                />
                <ComputedTotal
                  values={state.n_c_rechazo_parcial.map((r) => r.valor.valor)}
                  extractedValue={
                    state.total_n_c_rechazo_parcial.valor ||
                    state.rendicion.retorno_parcial.valor
                  }
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="credito_vendedor">
          <AccordionTrigger className="text-sm font-semibold">
            Detalle crédito vendedor
          </AccordionTrigger>
          <AccordionContent>
            <RowsEditor
              rows={state.detalle_credito_vendedor}
              columns={[
                {
                  key: "no_fac",
                  label: "N° factura",
                  catalogKey: "detalle_credito_vendedor.no_fac",
                },
                { key: "cliente", label: "Cliente" },
                { key: "nro_vendedor", label: "N° vendedor" },
                { key: "valor", label: "Monto" },
              ]}
              createEmpty={newCreditoVendedor}
              onChange={(rows) =>
                setState((s) => ({ ...s, detalle_credito_vendedor: rows }))
              }
              onHoverBbox={onHoverBbox}
            />
            <div className="mt-3">
              <ComputedTotal
                values={state.detalle_credito_vendedor.map((r) => r.valor.valor)}
                extractedValue={state.rendicion.credito_vendedor.valor}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="cheques">
          <AccordionTrigger className="text-sm font-semibold">
            Detalle de cheques
          </AccordionTrigger>
          <AccordionContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Cheques al día
              </p>
              <RowsEditor
                rows={state.detalles_cheques}
                filter={(row) => isChequeAlDia(row.fecha.valor, chequeRef)}
                columns={[
                  { key: "fecha", label: "Fecha", type: "date" },
                  {
                    key: "banco",
                    label: "Banco",
                    catalogKey: "detalles_cheques.banco",
                  },
                  { key: "valor", label: "Valor" },
                ]}
                createEmpty={newCheque}
                onChange={(rows) =>
                  setState((s) => ({ ...s, detalles_cheques: rows }))
                }
                onHoverBbox={onHoverBbox}
              />
              <ComputedTotal
                values={state.detalles_cheques
                  .filter((r) => isChequeAlDia(r.fecha.valor, chequeRef))
                  .map((r) => r.valor.valor)}
                extractedValue={state.rendicion.cheques_al_dia.valor}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Cheques a fecha
              </p>
              <RowsEditor
                rows={state.detalles_cheques}
                filter={(row) => !isChequeAlDia(row.fecha.valor, chequeRef)}
                columns={[
                  { key: "fecha", label: "Fecha", type: "date" },
                  {
                    key: "banco",
                    label: "Banco",
                    catalogKey: "detalles_cheques.banco",
                  },
                  { key: "valor", label: "Valor" },
                ]}
                createEmpty={newCheque}
                onChange={(rows) =>
                  setState((s) => ({ ...s, detalles_cheques: rows }))
                }
                onHoverBbox={onHoverBbox}
              />
              <ComputedTotal
                values={state.detalles_cheques
                  .filter((r) => !isChequeAlDia(r.fecha.valor, chequeRef))
                  .map((r) => r.valor.valor)}
                extractedValue={state.rendicion.cheques_a_fecha.valor}
              />
            </div>

            <div className="space-y-2 border-t pt-4">
              <FieldInput
                editKey="total_cheques"
                label="Total cheques"
                value={state.total_cheques}
                onChange={setField("total_cheques")}
                onHover={onHoverBbox}
                highlight={fieldHighlight("total_cheques")}
              />
              <ComputedTotal
                values={state.detalles_cheques.map((r) => r.valor.valor)}
                extractedValue={state.total_cheques.valor}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="efectivo">
          <AccordionTrigger className="text-sm font-semibold">
            Detalle de efectivo
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Billetes
              </p>
              <RowsEditor
                rows={state.detalle_efectivo.billetes}
                columns={[
                  {
                    key: "denominacion",
                    label: "Denominación",
                    catalogKey: "detalle_efectivo.billetes.denominacion",
                  },
                  { key: "valor", label: "Valor" },
                ]}
                createEmpty={newBillete}
                onChange={(rows) => patchDetalleEfectivo({ billetes: rows })}
                onHoverBbox={onHoverBbox}
              />
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Total billetes</span>
                <span className="font-mono tabular-nums font-medium">
                  {formatCLP(
                    parseNumber(state.detalle_efectivo.total_billetes.valor) ?? 0
                  )}
                </span>
              </div>
              <ComputedTotal
                values={state.detalle_efectivo.billetes.map((b) => b.valor.valor)}
                extractedValue={state.detalle_efectivo.total_billetes.valor}
              />
            </div>

            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Monedas
              </p>
              <RowsEditor
                rows={state.detalle_efectivo.monedas}
                columns={[
                  {
                    key: "denominacion",
                    label: "Denominación",
                    catalogKey: "detalle_efectivo.monedas.denominacion",
                  },
                  { key: "valor", label: "Valor" },
                ]}
                createEmpty={newBillete}
                onChange={(rows) => patchDetalleEfectivo({ monedas: rows })}
                onHoverBbox={onHoverBbox}
              />
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">Total monedas</span>
                <span className="font-mono tabular-nums font-medium">
                  {formatCLP(
                    parseNumber(state.detalle_efectivo.total_monedas.valor) ?? 0
                  )}
                </span>
              </div>
              <ComputedTotal
                values={state.detalle_efectivo.monedas.map((b) => b.valor.valor)}
                extractedValue={state.detalle_efectivo.total_monedas.valor}
              />
            </div>

            <div className="space-y-2 border-t pt-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Contraste con rendición
              </p>
              <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                <span className="text-muted-foreground">
                  Billetes + monedas
                </span>
                <span className="font-mono tabular-nums font-medium">
                  {formatCLP(
                    (parseNumber(state.detalle_efectivo.total_billetes.valor) ??
                      0) +
                      (parseNumber(state.detalle_efectivo.total_monedas.valor) ??
                        0)
                  )}
                </span>
              </div>
              <ComputedTotal
                values={[
                  ...state.detalle_efectivo.billetes.map((b) => b.valor.valor),
                  ...state.detalle_efectivo.monedas.map((b) => b.valor.valor),
                ]}
                extractedValue={state.rendicion.efectivo_total.valor}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="rechazos">
          <AccordionTrigger className="text-sm font-semibold">
            N/C por negocios
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="space-y-2">
              <RowsEditor
                rows={state.n_c_por_negocios}
                columns={[
                  {
                    key: "no_fac",
                    label: "N° factura",
                    catalogKey: "n_c_por_negocios.no_fac",
                  },
                  { key: "valor", label: "Valor" },
                ]}
                createEmpty={newNc}
                onChange={(rows) =>
                  setState((s) => ({ ...s, n_c_por_negocios: rows }))
                }
                onHoverBbox={onHoverBbox}
              />
              <FieldInput
                editKey="total_n_c_por_negocios"
                label="Total N/C negocio"
                value={state.total_n_c_por_negocios}
                onChange={setField("total_n_c_por_negocios")}
                onHover={onHoverBbox}
                highlight={fieldHighlight("total_n_c_por_negocios")}
              />
              <ComputedTotal
                values={state.n_c_por_negocios.map((r) => r.valor.valor)}
                extractedValue={state.total_n_c_por_negocios.valor}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="transferencias">
          <AccordionTrigger className="text-sm font-semibold">
            Transferencias (observaciones)
          </AccordionTrigger>
          <AccordionContent>
            <p className="mb-3 text-xs text-muted-foreground">
              N° factura, cliente, banco y monto. El banco se muestra con su
              nombre completo (Banco Estado, Voucher Banco Estado, Banco
              Santander).
            </p>
            <RowsEditor
              rows={state.detalle_transferencias}
              columns={[
                {
                  key: "no_fac",
                  label: "N° factura",
                  catalogKey: "detalle_transferencias.no_fac",
                },
                { key: "cliente", label: "Cliente" },
                {
                  key: "banco",
                  label: "Banco",
                  catalogKey: "detalle_transferencias.banco",
                },
                { key: "valor", label: "Monto" },
              ]}
              createEmpty={newTransferencia}
              onChange={(rows) =>
                setState((s) => ({ ...s, detalle_transferencias: rows }))
              }
              onHoverBbox={onHoverBbox}
            />
            <div className="mt-3 space-y-2">
              <FieldInput
                editKey="total_transferencias"
                label="Total transferencias"
                value={state.total_transferencias}
                onChange={setField("total_transferencias")}
                onHover={onHoverBbox}
                highlight={fieldHighlight("total_transferencias")}
              />
              <ComputedTotal
                values={state.detalle_transferencias.map((r) => r.valor.valor)}
                extractedValue={state.total_transferencias.valor}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="deposito">
          <AccordionTrigger className="text-sm font-semibold">
            Depósito y observaciones
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FieldInput
                editKey="numero_deposito_en_efectivo"
                label="Número depósito efectivo"
                value={state.numero_deposito_en_efectivo}
                onChange={setField("numero_deposito_en_efectivo")}
                onHover={onHoverBbox}
              />
              <FieldInput
                editKey="monto_deposito_en_efectivo"
                label="Monto depósito efectivo"
                value={state.monto_deposito_en_efectivo}
                onChange={setField("monto_deposito_en_efectivo")}
                onHover={onHoverBbox}
              />
            </div>
            <div className="mt-3 space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">
                Observaciones
              </p>
              <Textarea
                value={state.observaciones.valor}
                onChange={(e) =>
                  setState((s) => ({
                    ...s,
                    observaciones: { ...s.observaciones, valor: e.target.value },
                  }))
                }
                className="min-h-[80px]"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
