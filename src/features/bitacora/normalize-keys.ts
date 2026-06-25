import { RECORRIDO_SUFFIX_LEN } from "./config";

export function normalizePatente(value: string | undefined | null): string {
  if (!value) return "";
  return value
    .toUpperCase()
    .replace(/[\s\-./]+/g, "")
    .trim();
}

export function normalizeRecorridoDigits(
  value: string | undefined | null
): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

export function recorridoSuffix(
  value: string | undefined | null,
  len = RECORRIDO_SUFFIX_LEN
): string {
  const digits = normalizeRecorridoDigits(value);
  if (!digits) return "";
  return digits.slice(-len);
}

export function normalizeName(value: string | undefined | null): string {
  if (!value) return "";
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function namesMatch(
  a: string | undefined | null,
  b: string | undefined | null
): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const aParts = na.split(" ");
  const bParts = nb.split(" ");
  return aParts.some((p) => p.length >= 3 && bParts.includes(p));
}
