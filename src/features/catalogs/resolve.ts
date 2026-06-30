import type { Catalog, CatalogItem } from "./types";

/** Texto legible de un ítem (lo que ve el revisor). */
export function catalogItemDisplay(item: CatalogItem): string {
  return item.label?.trim() || item.value;
}

export function findCatalogItem(
  catalog: Catalog,
  raw: string
): CatalogItem | undefined {
  const v = raw.trim();
  if (!v) return undefined;
  const lower = v.toLowerCase();
  for (const item of catalog.items) {
    if (item.value.toLowerCase() === lower) return item;
    if (catalogItemDisplay(item).toLowerCase() === lower) return item;
    if (item.aliases?.some((a) => a.toLowerCase() === lower)) return item;
  }
  return undefined;
}

/** Convierte código OCR (VE) o alias → nombre para mostrar en revisión. */
export function resolveCatalogDisplayValue(
  catalog: Catalog,
  raw: string
): string {
  const item = findCatalogItem(catalog, raw);
  return item ? catalogItemDisplay(item) : raw;
}

/** Normaliza lo escrito o elegido → valor canónico del catálogo (nombre completo). */
export function resolveCatalogStoredValue(
  catalog: Catalog,
  raw: string
): string {
  const item = findCatalogItem(catalog, raw);
  return item ? item.value : raw;
}
