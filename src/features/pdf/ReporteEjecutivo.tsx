"use client";

import { Fragment, useEffect, useMemo, useRef } from "react";
import {
  buildHeaderData,
  computeIncomeTotals,
  formatearMoneda,
  getDetailItems,
  migrateLegacyTransfers,
  type CashItem,
  type DetailCategoryId,
  type IncomeTotals,
  type RowItem,
} from "./reporte-utils";
import {
  ensureExtractionShape,
  type Record,
} from "@/features/records/types";
import { getTotalsStatus } from "@/features/records/totals";
import { ExcelExportButton } from "@/components/admin/ExcelExportButton";
import { APP_NAME, BRAND_LOGO_SRC, BRAND_LAB_NAME } from "@/lib/constants";

type ReporteEjecutivoProps = {
  record: Record;
};

type RowExtraColumn = {
  key: keyof Pick<RowItem, "banco" | "cliente" | "vendedor">;
  label: string;
};

function getDetailExtraColumns(catId: DetailCategoryId): RowExtraColumn[] {
  switch (catId) {
    case "cheques":
      return [{ key: "banco", label: "Banco" }];
    case "transferencias":
      return [
        { key: "cliente", label: "Cliente" },
        { key: "banco", label: "Banco" },
      ];
    case "creditoVendedor":
      return [
        { key: "cliente", label: "Cliente" },
        { key: "vendedor", label: "N° vendedor" },
      ];
    default:
      return [];
  }
}

const FILAS_RESUMEN: { key: keyof IncomeTotals; label: string }[] = [
  { key: "efectivo", label: "Efectivo" },
  { key: "chequesAlDia", label: "Cheques al día" },
  { key: "chequesAFecha", label: "Cheques a fecha" },
  { key: "creditoVendedor", label: "Crédito vendedor" },
  { key: "rechazoTotal", label: "Retorno total" },
  { key: "rechazoParcial", label: "Retorno parcial" },
  { key: "ncNegocio", label: "N/C Negocio" },
  { key: "transferencias", label: "Transferencias" },
];

const CATEGORIAS_DETALLE: DetailCategoryId[] = [
  "cheques",
  "chequesAFecha",
  "rechazoTotal",
  "rechazoParcial",
  "creditoVendedor",
  "ncNegocio",
  "efectivo",
  "transferencias",
];

const NOMBRES_CATEGORIA: globalThis.Record<DetailCategoryId, string> = {
  efectivo: "Efectivo",
  cheques: "Cheques al día",
  chequesAFecha: "Cheques a fecha",
  rechazoTotal: "Retorno total",
  rechazoParcial: "Retorno parcial",
  ncNegocio: "N/C Negocio",
  transferencias: "Transferencias",
  creditoVendedor: "Crédito vendedor",
};

function formatNow(): string {
  return new Date().toLocaleDateString("es-CL", {
    timeZone: "America/Santiago",
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function celdaCompacta(label: string, valor: string) {
  return (
    <tr className="border-b border-slate-200 print:border-slate-300">
      <td className="py-0.5 pr-2 text-slate-600 print:text-slate-700 text-xs print:text-[8pt]">
        {label}
      </td>
      <td className="py-0.5 text-right font-medium text-slate-900 break-words text-xs print:text-[8pt]">
        {valor}
      </td>
    </tr>
  );
}

export function ReporteEjecutivo({ record }: ReporteEjecutivoProps) {
  const reportRef = useRef<HTMLDivElement>(null);
  const header = useMemo(() => buildHeaderData(record), [record]);

  /**
   * Vista canónica de la extracción para el reporte: garantiza el shape
   * actual y migra al vuelo transferencias antiguas que estaban dentro de
   * "observaciones". Se usa para TODO lo que se renderice (totales, detalle
   * y el bloque de observaciones libres).
   */
  const view = useMemo(
    () =>
      record.extraction
        ? migrateLegacyTransfers(ensureExtractionShape(record.extraction))
        : null,
    [record.extraction]
  );

  const totales = useMemo<IncomeTotals>(
    () =>
      view
        ? computeIncomeTotals(view)
        : {
            efectivo: 0,
            chequesAlDia: 0,
            chequesAFecha: 0,
            creditoVendedor: 0,
            rechazoTotal: 0,
            rechazoParcial: 0,
            ncNegocio: 0,
            transferencias: 0,
            total: 0,
          },
    [view]
  );

  const totalRuta = header.totalEsperadoRuta;
  const diferencia = totales.total - totalRuta;
  const fechaGeneracion = formatNow();

  useEffect(() => {
    const prev = document.title;
    document.title = header.nombreArchivoBase;
    return () => {
      document.title = prev;
    };
  }, [header.nombreArchivoBase]);

  const handleImprimir = () => window.print();

  const detalles = useMemo(() => {
    if (!view) return [];
    return CATEGORIAS_DETALLE.map((catId) => ({
      catId,
      data: getDetailItems(view, catId),
    })).filter(
      ({ catId, data }) =>
        data.items.length > 0 ||
        // chequesAFecha y creditoVendedor no tienen items pero pueden tener subtotal
        ((catId === "chequesAFecha" || catId === "creditoVendedor") &&
          data.total > 0)
    );
  }, [view]);

  const totalsStatus = useMemo(
    () => (view ? getTotalsStatus(view) : null),
    [view]
  );

  return (
    <div className="flex min-h-dvh flex-col bg-slate-100 print:bg-white">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            size: letter;
            margin: 8mm;
          }
          .reporte-ejecutivo {
            transform-origin: top left;
            max-height: 279mm;
            overflow: hidden;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
        }
      `,
        }}
      />

      {/* Controles solo en pantalla */}
      <div className="sticky top-0 z-10 flex shrink-0 flex-wrap gap-2 bg-white px-4 py-3 shadow-sm print:hidden sm:gap-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={handleImprimir}
          className="rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white shadow transition hover:bg-slate-700"
        >
          Imprimir / Guardar PDF
        </button>
        <ExcelExportButton record={record} size="default" />
        <button
          type="button"
          onClick={() => window.close()}
          className="rounded-xl border-2 border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cerrar pestaña
        </button>
      </div>

      <div
        ref={reportRef}
        className="reporte-ejecutivo mx-auto w-full max-w-[216mm] flex-1 bg-white px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:px-6 print:py-4 print:text-[8pt] print:[page-size:letter]"
      >
        {/* Encabezado */}
        <header className="border-b-2 border-slate-800 pb-2 print:pb-1.5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 print:text-[14pt]">
                REPORTE EJECUTIVO FINANCIERO
              </h1>
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500 print:text-[8pt]">
                Cierre de turno
              </p>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={BRAND_LOGO_SRC}
              alt="404LAB"
              className="h-8 w-auto shrink-0 print:h-7"
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-600 print:text-[8pt]">
            <span>
              ID:{" "}
              <strong className="text-slate-900">
                {header.registroId.slice(0, 8)}…
              </strong>
            </span>
            <span>Generado: {fechaGeneracion}</span>
          </div>
        </header>

        {/* Fila 1: Datos del turno + Resumen de ingresos */}
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 print:mt-3 print:grid-cols-2 print:gap-4 print:[break-inside:avoid]">
          <section className="min-w-0">
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-700 print:text-[8pt]">
              1. Datos del turno
            </h2>
            <table className="w-full border-collapse text-xs print:text-[8pt]">
              <tbody>
                {celdaCompacta("Fecha creación (Chile)", header.fechaCreacion)}
                {celdaCompacta("Fecha del documento", header.fechaDocumento)}
                {celdaCompacta("Conductor", header.conductor)}
                {celdaCompacta("Auxiliar", header.auxiliar)}
                {celdaCompacta("Nº Recorrido", header.numeroRecorrido)}
                {celdaCompacta("Patente", header.patente)}
                {celdaCompacta("Cant. facturas", header.cantidadFacturas)}
                {celdaCompacta(
                  "Total esperado ruta",
                  formatearMoneda(header.totalEsperadoRuta)
                )}
              </tbody>
            </table>
          </section>

          <section className="min-w-0">
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-700 print:text-[8pt]">
              2. Resumen de ingresos por categoría
            </h2>
            <table className="w-full border-collapse text-xs print:text-[8pt]">
              <thead>
                <tr className="border-b border-slate-300 bg-slate-50">
                  <th className="py-0.5 text-left font-semibold text-slate-800">
                    Concepto
                  </th>
                  <th className="py-0.5 text-right font-semibold text-slate-800">
                    Monto
                  </th>
                </tr>
              </thead>
              <tbody>
                {FILAS_RESUMEN.map(({ key, label }) => (
                  <tr key={key} className="border-b border-slate-200">
                    <td className="py-0.5 text-slate-700 break-words">
                      {label}
                    </td>
                    <td className="py-0.5 text-right font-medium text-slate-900 break-words sm:whitespace-nowrap print:whitespace-nowrap">
                      {formatearMoneda(totales[key])}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        {/* Fila 2: Resultado */}
        <section className="mt-4 print:mt-3 print:[break-inside:avoid]">
          <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-700 print:text-[8pt]">
            3. Resultado
          </h2>
          <table className="w-full max-w-md border-collapse text-xs print:text-[8pt]">
            <tbody>
              <tr className="border-b-2 border-slate-400">
                <td className="py-1 font-semibold text-slate-800">
                  Total recaudado
                </td>
                <td className="py-1 text-right font-bold text-slate-900 print:text-[10pt]">
                  {formatearMoneda(totales.total)}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-0.5 text-slate-700">Total esperado ruta</td>
                <td className="py-0.5 text-right font-medium text-slate-900">
                  {formatearMoneda(totalRuta)}
                </td>
              </tr>
              <tr className="border-b border-slate-200">
                <td className="py-1 font-medium text-slate-800">Diferencia</td>
                <td
                  className={`py-1 text-right font-bold ${
                    diferencia >= 0
                      ? "text-emerald-700 print:text-slate-900"
                      : "text-red-700 print:text-slate-900"
                  }`}
                >
                  {diferencia >= 0 ? "+" : ""}
                  {formatearMoneda(diferencia)}
                </td>
              </tr>
            </tbody>
          </table>

          {totalsStatus &&
            (totalsStatus.missing.length > 0 ||
              totalsStatus.mismatches.length > 0) && (
              <div className="mt-2 rounded-md border border-amber-400 bg-amber-50 p-2 text-[11px] text-amber-900 print:text-[8pt]">
                <p className="font-semibold uppercase tracking-wide">
                  Descuadre de totales
                </p>
                {totalsStatus.missing.length > 0 && (
                  <ul className="mt-1 list-disc pl-4">
                    {totalsStatus.missing.map((m) => (
                      <li key={m.id}>
                        {m.label}: total no declarado · suma de filas{" "}
                        <span className="font-mono">
                          {formatearMoneda(m.sumItems)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {totalsStatus.mismatches.length > 0 && (
                  <ul className="mt-1 list-disc pl-4">
                    {totalsStatus.mismatches.map((m) => (
                      <li key={m.id}>
                        {m.label}: declarado{" "}
                        <span className="font-mono">
                          {formatearMoneda(m.declared ?? 0)}
                        </span>{" "}
                        ≠ suma{" "}
                        <span className="font-mono">
                          {formatearMoneda(m.sumItems)}
                        </span>{" "}
                        · Δ{" "}
                        <span className="font-mono font-semibold">
                          {formatearMoneda(Math.abs(m.diff ?? 0))}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
        </section>

        {/* Fila 3: Detalle por categoría */}
        {detalles.length > 0 && (
          <section className="mt-4 print:mt-3">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-700 print:mb-1 print:text-[8pt]">
              4. Detalle por categoría
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
              {detalles.map(({ catId, data }) => {
                const nombre = NOMBRES_CATEGORIA[catId];
                const columnasExtra = getDetailExtraColumns(catId);
                return (
                  <div
                    key={catId}
                    className="min-h-0 rounded border border-slate-200 p-2 print:border-slate-300 print:p-1.5 print:[break-inside:avoid]"
                  >
                    <p className="mb-1 text-[10px] font-bold uppercase text-slate-600 print:text-[7pt]">
                      {nombre}
                    </p>

                    {catId === "efectivo" ? (
                      <div className="overflow-x-auto print:overflow-visible">
                      <table className="w-full min-w-[240px] border-collapse text-[10px] print:min-w-0 print:text-[7pt]">
                        <tbody>
                          {(() => {
                            const cash = data.items as CashItem[];
                            const billetes = cash.filter(
                              (i) => i.tipo !== "moneda"
                            );
                            const monedas = cash.filter(
                              (i) => i.tipo === "moneda"
                            );
                            const renderRows = (items: CashItem[]) =>
                              items.map((item, i) => (
                                <tr
                                  key={i}
                                  className="border-b border-slate-100"
                                >
                                  <td className="py-0.5 break-words text-slate-900 print:text-slate-800">
                                    {item.denominacion}
                                  </td>
                                  <td className="py-0.5 text-center break-words text-slate-900 sm:whitespace-nowrap print:text-slate-800 print:whitespace-nowrap">
                                    {item.cantidad > 0
                                      ? `×${item.cantidad}`
                                      : "—"}
                                  </td>
                                  <td className="py-0.5 text-right font-medium break-words text-slate-900 sm:whitespace-nowrap print:text-slate-800 print:whitespace-nowrap">
                                    {formatearMoneda(item.valor)}
                                  </td>
                                </tr>
                              ));
                            return (
                              <>
                                {billetes.length > 0 && (
                                  <>
                                    <tr>
                                      <td
                                        colSpan={3}
                                        className="py-0.5 text-[9px] font-semibold uppercase text-slate-500"
                                      >
                                        Billetes
                                      </td>
                                    </tr>
                                    {renderRows(billetes)}
                                  </>
                                )}
                                {monedas.length > 0 && (
                                  <>
                                    <tr>
                                      <td
                                        colSpan={3}
                                        className="py-0.5 pt-1 text-[9px] font-semibold uppercase text-slate-500"
                                      >
                                        Monedas
                                      </td>
                                    </tr>
                                    {renderRows(monedas)}
                                  </>
                                )}
                              </>
                            );
                          })()}
                          <tr className="font-semibold text-slate-900 print:text-slate-800">
                            <td colSpan={2} className="py-0.5 pt-1">
                              Subtotal
                            </td>
                            <td className="py-0.5 pt-1 text-right">
                              {formatearMoneda(data.total)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      </div>
                    ) : data.items.length === 0 ? (
                      <div className="overflow-x-auto print:overflow-visible">
                      <table className="w-full min-w-[200px] border-collapse text-[10px] print:min-w-0 print:text-[7pt]">
                        <tbody>
                          <tr className="font-semibold text-slate-900 print:text-slate-800">
                            <td className="py-0.5">Subtotal</td>
                            <td className="py-0.5 text-right">
                              {formatearMoneda(data.total)}
                            </td>
                          </tr>
                          <tr>
                            <td
                              colSpan={2}
                              className="py-1 text-[9px] italic text-slate-500"
                            >
                              Sin desglose individual extraído.
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      </div>
                    ) : (
                      <div className="overflow-x-auto print:overflow-visible">
                      <table className="w-full min-w-[280px] border-collapse text-[10px] print:min-w-0 print:text-[7pt]">
                        <thead>
                          <tr className="border-b border-slate-300 font-semibold text-slate-700 print:border-slate-400 print:text-slate-800">
                            <th className="py-0.5 text-left">Descripción</th>
                            {columnasExtra.map((col) => (
                              <th key={col.key} className="py-0.5 text-left">
                                {col.label}
                              </th>
                            ))}
                            <th className="py-0.5 text-right">Monto</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(data.items as RowItem[]).map((item, i) => (
                            <Fragment key={i}>
                              <tr className="border-b border-slate-100">
                                <td className="py-0.5 text-slate-900 break-words min-w-0 print:text-slate-700">
                                  {item.descripcion}
                                </td>
                                {columnasExtra.map((col) => (
                                  <td
                                    key={col.key}
                                    className="py-0.5 text-slate-900 break-words min-w-0 print:text-slate-700"
                                  >
                                    {item[col.key]?.trim() || "—"}
                                  </td>
                                ))}
                                <td className="py-0.5 text-right font-medium break-words text-slate-900 sm:whitespace-nowrap print:text-slate-800 print:whitespace-nowrap">
                                  {formatearMoneda(item.monto)}
                                </td>
                              </tr>
                            </Fragment>
                          ))}
                          <tr className="font-semibold text-slate-900 print:text-slate-800">
                            <td
                              colSpan={1 + columnasExtra.length}
                              className="py-0.5 pt-1"
                            >
                              Subtotal
                            </td>
                            <td className="py-0.5 pt-1 text-right">
                              {formatearMoneda(data.total)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Observaciones (texto libre que no son transferencias) */}
        {view?.observaciones.valor.trim() && (
          <section className="mt-4 print:mt-3 print:[break-inside:avoid]">
            <h2 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-700 print:text-[8pt]">
              5. Observaciones
            </h2>
            <p className="whitespace-pre-wrap rounded border border-slate-200 p-2 text-xs text-slate-700 print:text-[8pt]">
              {view.observaciones.valor}
            </p>
          </section>
        )}

        <footer className="mt-6 border-t border-slate-200 pt-2 text-center text-[10px] text-slate-500 print:mt-4 print:text-[7pt]">
          Documento generado por {APP_NAME} · {BRAND_LAB_NAME} · {header.registroId.slice(0, 8)}… ·{" "}
          {new Date().toLocaleDateString("es-CL", {
            timeZone: "America/Santiago",
          })}
        </footer>
      </div>
    </div>
  );
}
