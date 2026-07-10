"use client";

import { toast } from "sonner";

/**
 * Descarga el Excel de un registro mostrando el error del API si falla
 * (el `<a download>` silencia respuestas JSON 4xx/5xx).
 */
export async function downloadRecordExcel(recordId: string): Promise<void> {
  const res = await fetch(`/api/records/${recordId}/excel`, {
    method: "GET",
    cache: "no-store",
  });

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(err.message ?? `No se pudo generar el Excel (${res.status})`);
  }

  const blob = await res.blob();
  if (blob.size < 10_000) {
    throw new Error("El Excel generado está incompleto");
  }

  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename\*=UTF-8''([^;]+)|filename="([^"]+)"/);
  const rawName = match?.[1] ? decodeURIComponent(match[1]) : match?.[2];
  const filename = rawName || `rendicion-${recordId.slice(0, 8)}.xlsx`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadRecordExcelWithToast(
  recordId: string
): Promise<void> {
  try {
    await downloadRecordExcel(recordId);
    toast.success("Excel descargado");
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Error al descargar Excel"
    );
  }
}
