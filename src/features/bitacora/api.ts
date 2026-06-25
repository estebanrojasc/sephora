import type {
  Bitacora,
  BitacoraRow,
  CreateBitacoraPayload,
  ParseBitacoraResult,
} from "./types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(
      (data as { message?: string }).message ?? `Error ${res.status}`
    );
  }
  return res.json() as Promise<T>;
}

export async function fetchBitacoras(params?: {
  date?: string;
  activeOnly?: boolean;
}): Promise<Bitacora[]> {
  const qs = new URLSearchParams();
  if (params?.date) qs.set("date", params.date);
  if (params?.activeOnly) qs.set("active", "1");
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return handle<Bitacora[]>(
    await fetch(`/api/bitacora${suffix}`, { cache: "no-store" })
  );
}

export async function fetchBitacoraDates(): Promise<string[]> {
  return handle<string[]>(
    await fetch("/api/bitacora/dates", { cache: "no-store" })
  );
}

export async function fetchBitacoraById(id: string): Promise<Bitacora> {
  return handle<Bitacora>(
    await fetch(`/api/bitacora/${id}`, { cache: "no-store" })
  );
}

export async function createBitacoraApi(
  payload: CreateBitacoraPayload
): Promise<Bitacora> {
  return handle<Bitacora>(
    await fetch("/api/bitacora", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}

export async function parseBitacoraApi(
  rawPaste: string,
  options?: { useAi?: boolean }
): Promise<ParseBitacoraResult & { provider?: string }> {
  return handle(
    await fetch("/api/bitacora/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawPaste, useAi: options?.useAi ?? false }),
    })
  );
}

export async function createRecordFromBitacoraApi(payload: {
  bitacoraId: string;
  rowId: string;
}): Promise<{ recordId: string }> {
  return handle(
    await fetch("/api/records/from-bitacora", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}

export type { Bitacora, BitacoraRow };
