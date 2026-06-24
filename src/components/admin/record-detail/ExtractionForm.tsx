"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
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
} from "@/features/records/types";

const EMPTY: ExtractedField = { valor: "", bbox: [0, 0, 0, 0] };

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
});
const newBillete = (): BilleteRow => ({
  denominacion: { ...EMPTY },
  valor: { ...EMPTY },
});

export interface ExtractionFormHandle {
  getValues: () => Extraction;
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
}

export function ExtractionForm({
  extraction,
  formRef,
  onHoverBbox,
  onStateChange,
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

  useImperativeHandle(formRef, () => ({ getValues: () => state }), [state]);

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
              />
              <FieldInput
                editKey="rendicion.retorno_total"
                label="Retorno total"
                value={state.rendicion.retorno_total}
                onChange={setRendField("retorno_total")}
                onHover={onHoverBbox}
              />
              <FieldInput
                editKey="rendicion.retorno_parcial"
                label="Retorno parcial"
                value={state.rendicion.retorno_parcial}
                onChange={setRendField("retorno_parcial")}
                onHover={onHoverBbox}
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
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="cheques">
          <AccordionTrigger className="text-sm font-semibold">
            Detalle de cheques
          </AccordionTrigger>
          <AccordionContent>
            <RowsEditor
              rows={state.detalles_cheques}
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
            <div className="mt-3 space-y-2">
              <FieldInput
                editKey="total_cheques"
                label="Total cheques"
                value={state.total_cheques}
                onChange={setField("total_cheques")}
                onHover={onHoverBbox}
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
          <AccordionContent>
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
              onChange={(rows) =>
                setState((s) => ({
                  ...s,
                  detalle_efectivo: { ...s.detalle_efectivo, billetes: rows },
                }))
              }
              onHoverBbox={onHoverBbox}
            />
            <div className="mt-3 space-y-2">
              <FieldInput
                editKey="detalle_efectivo.total_efectivo"
                label="Total efectivo"
                value={state.detalle_efectivo.total_efectivo}
                onChange={(val) =>
                  setState((s) => ({
                    ...s,
                    detalle_efectivo: {
                      ...s.detalle_efectivo,
                      total_efectivo: val,
                    },
                  }))
                }
                onHover={onHoverBbox}
              />
              <ComputedTotal
                values={state.detalle_efectivo.billetes.map((b) => b.valor.valor)}
                extractedValue={state.detalle_efectivo.total_efectivo.valor}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="rechazos">
          <AccordionTrigger className="text-sm font-semibold">
            Notas de crédito / Rechazos
          </AccordionTrigger>
          <AccordionContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Rechazo total
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
                label="Total rechazo total"
                value={state.total_n_c_rechazo_total}
                onChange={setField("total_n_c_rechazo_total")}
                onHover={onHoverBbox}
              />
              <ComputedTotal
                values={state.n_c_rechazo_total.map((r) => r.valor.valor)}
                extractedValue={state.total_n_c_rechazo_total.valor}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Rechazo parcial
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
                label="Total rechazo parcial"
                value={state.total_n_c_rechazo_parcial}
                onChange={setField("total_n_c_rechazo_parcial")}
                onHover={onHoverBbox}
              />
              <ComputedTotal
                values={state.n_c_rechazo_parcial.map((r) => r.valor.valor)}
                extractedValue={state.total_n_c_rechazo_parcial.valor}
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Por negocios
              </p>
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
                label="Total por negocios"
                value={state.total_n_c_por_negocios}
                onChange={setField("total_n_c_por_negocios")}
                onHover={onHoverBbox}
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
              Filas extraídas del cuadro inferior &quot;observaciones&quot;: N°
              factura, cliente y monto.
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
