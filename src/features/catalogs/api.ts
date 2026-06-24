import type {
  Catalog,
  CreateCatalogPayload,
  UpdateCatalogPayload,
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

export async function fetchCatalogs(): Promise<Catalog[]> {
  return handle<Catalog[]>(await fetch("/api/catalogs", { cache: "no-store" }));
}

export async function createCatalogApi(
  payload: CreateCatalogPayload
): Promise<Catalog> {
  return handle<Catalog>(
    await fetch("/api/catalogs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}

export async function updateCatalogApi(
  id: string,
  payload: UpdateCatalogPayload
): Promise<Catalog> {
  return handle<Catalog>(
    await fetch(`/api/catalogs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
  );
}

export async function deleteCatalogApi(id: string): Promise<void> {
  await handle<{ ok: true }>(
    await fetch(`/api/catalogs/${id}`, { method: "DELETE" })
  );
}
