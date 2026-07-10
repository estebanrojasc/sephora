import { fetchJsonNoStore } from "@/lib/fetch-client";
import type {
  Bitacora,
  BitacoraRow,
  CreateBitacoraPayload,
  ParseBitacoraResult,
} from "./types";
import type { BitacoraRowPatch } from "./row-patch";

export async function fetchBitacoras(params?: {
  date?: string;
  activeOnly?: boolean;
}): Promise<Bitacora[]> {
  const qs = new URLSearchParams();
  if (params?.date) qs.set("date", params.date);
  if (params?.activeOnly) qs.set("active", "1");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return fetchJsonNoStore<Bitacora[]>(`/api/bitacora${suffix}`);
}

export async function fetchBitacoraDates(): Promise<string[]> {
  return fetchJsonNoStore<string[]>("/api/bitacora/dates");
}

export async function fetchBitacoraById(id: string): Promise<Bitacora> {
  return fetchJsonNoStore<Bitacora>(`/api/bitacora/${id}`);
}

export async function createBitacoraApi(
  payload: CreateBitacoraPayload
): Promise<Bitacora> {
  return fetchJsonNoStore<Bitacora>("/api/bitacora", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function parseBitacoraApi(
  rawPaste: string,
  options?: { useAi?: boolean }
): Promise<ParseBitacoraResult & { provider?: string }> {
  return fetchJsonNoStore("/api/bitacora/parse", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rawPaste, useAi: options?.useAi ?? false }),
  });
}

export async function updateBitacoraRowApi(
  bitacoraId: string,
  payload: { rowId: string } & BitacoraRowPatch
): Promise<Bitacora> {
  return fetchJsonNoStore<Bitacora>(`/api/bitacora/${bitacoraId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

/** @deprecated Usar updateBitacoraRowApi */
export async function updateBitacoraRowSettingsApi(
  bitacoraId: string,
  payload: { rowId: string; allowsMultipleReviews: boolean }
): Promise<Bitacora> {
  return updateBitacoraRowApi(bitacoraId, payload);
}

export async function createRecordFromBitacoraApi(payload: {
  bitacoraId: string;
  rowId: string;
}): Promise<{ recordId: string }> {
  return fetchJsonNoStore("/api/records/from-bitacora", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function createMissingRecordsFromBitacoraApi(payload: {
  bitacoraId: string;
}): Promise<{
  created: number;
  recordIds: string[];
  failures: { recorrido: string; message: string }[];
}> {
  return fetchJsonNoStore("/api/records/from-bitacora/missing", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export type { Bitacora, BitacoraRow };
