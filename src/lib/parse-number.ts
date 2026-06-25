/**
 * Convierte comas usadas como separador de miles al punto (formato chileno).
 * Conserva comas decimales (1-2 dígitos finales sin puntos previos).
 */
export function normalizeThousandsDisplay(
  value: string | undefined | null
): string {
  if (value == null) return "";
  const raw = String(value).trim();
  if (!raw.includes(",")) return raw;

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  const tailAfterComma = raw.length - lastComma - 1;
  const commaCount = (raw.match(/,/g) ?? []).length;

  if (
    commaCount === 1 &&
    lastDot === -1 &&
    tailAfterComma >= 1 &&
    tailAfterComma <= 2
  ) {
    return raw;
  }

  if (
    commaCount >= 1 &&
    (commaCount > 1 ||
      tailAfterComma === 3 ||
      lastDot > lastComma ||
      lastDot === -1)
  ) {
    return raw.replace(/,/g, ".");
  }

  return raw;
}

/**
 * Intenta interpretar un string monetario en formato chileno/internacional y
 * devolver un número. Acepta separadores . y , como miles o decimales,
 * símbolos $ y espacios. Devuelve null si no puede.
 */
export function parseNumber(value: string | undefined | null): number | null {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const cleaned = raw.replace(/[^\d,.\-]/g, "");
  if (!cleaned || cleaned === "-") return null;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");

  let normalized: string;
  if (lastDot > -1 && lastComma > -1) {
    if (lastComma > lastDot) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = cleaned.replace(/,/g, "");
    }
  } else if (lastComma > -1) {
    const tail = cleaned.length - lastComma - 1;
    normalized = tail <= 2 ? cleaned.replace(",", ".") : cleaned.replace(/,/g, "");
  } else if (lastDot > -1) {
    const tail = cleaned.length - lastDot - 1;
    const dotCount = (cleaned.match(/\./g) ?? []).length;
    if (dotCount > 1 || tail === 3) {
      normalized = cleaned.replace(/\./g, "");
    } else {
      normalized = cleaned;
    }
  } else {
    normalized = cleaned;
  }

  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

const CLP_FORMATTER = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export function formatCLP(n: number): string {
  return CLP_FORMATTER.format(n);
}
