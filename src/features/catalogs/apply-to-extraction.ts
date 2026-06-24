import type { Extraction, ExtractedField } from "@/features/records/types";
import type { Catalog } from "./types";

function normalizeAgainstCatalog(raw: string, catalog: Catalog): string {
  const v = raw.trim();
  if (!v) return raw;
  const lower = v.toLowerCase();
  for (const item of catalog.items) {
    if (item.value.toLowerCase() === lower) return item.value;
    for (const alias of item.aliases ?? []) {
      if (alias.toLowerCase() === lower) return item.value;
    }
  }
  return raw;
}

function applyField(field: ExtractedField, catalog: Catalog): ExtractedField {
  const next = normalizeAgainstCatalog(field.valor, catalog);
  return next === field.valor ? field : { ...field, valor: next };
}

/**
 * Ajusta valores de la extracción a los catálogos activos cuando el texto
 * coincide con un ítem o alias (insensible a mayúsculas).
 */
export function applyCatalogsToExtraction(
  extraction: Extraction,
  catalogs: Catalog[]
): Extraction {
  const byKey = new Map(
    catalogs.filter((c) => c.active).map((c) => [c.fieldKey, c])
  );
  if (byKey.size === 0) return extraction;

  const next: Extraction = { ...extraction };

  for (const key of ["conductor", "auxiliar", "patente", "n_recorrido"] as const) {
    const cat = byKey.get(key);
    if (cat) next[key] = applyField(next[key], cat);
  }

  const bancoCat = byKey.get("detalles_cheques.banco");
  if (bancoCat) {
    next.detalles_cheques = next.detalles_cheques.map((row) => ({
      ...row,
      banco: applyField(row.banco, bancoCat),
    }));
  }

  const denomCat = byKey.get("detalle_efectivo.billetes.denominacion");
  if (denomCat) {
    next.detalle_efectivo = {
      ...next.detalle_efectivo,
      billetes: next.detalle_efectivo.billetes.map((row) => ({
        ...row,
        denominacion: applyField(row.denominacion, denomCat),
      })),
    };
  }

  const ncArrayKeys = [
    ["n_c_rechazo_total", "n_c_rechazo_total.no_fac"],
    ["n_c_rechazo_parcial", "n_c_rechazo_parcial.no_fac"],
    ["n_c_por_negocios", "n_c_por_negocios.no_fac"],
  ] as const;

  for (const [arrayKey, fieldKey] of ncArrayKeys) {
    const cat = byKey.get(fieldKey);
    if (!cat) continue;
    next[arrayKey] = next[arrayKey].map((row) => ({
      ...row,
      no_fac: applyField(row.no_fac, cat),
    }));
  }

  const transfCat = byKey.get("detalle_transferencias.no_fac");
  if (transfCat) {
    next.detalle_transferencias = next.detalle_transferencias.map((row) => ({
      ...row,
      no_fac: applyField(row.no_fac, transfCat),
    }));
  }

  return next;
}
