/**
 * Intenta convertir un string de fecha (formatos comunes en Chile) a ISO
 * `YYYY-MM-DD`. Acepta separadores `/`, `-`, `.` y años de 2 o 4 dígitos.
 *
 * Ejemplos válidos:
 *   "1/12/23"   → "2023-12-01"
 *   "01/12/2023"→ "2023-12-01"
 *   "1-12-23"   → "2023-12-01"
 *   "2023-12-01"→ "2023-12-01"
 *   "01-05"     → con `referenceYear=2026` → "2026-05-01"
 *
 * Devuelve null si no puede interpretarse.
 */
export function parseToIso(
  value: string | undefined | null,
  referenceYear?: number
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  // ISO directo
  const iso = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return buildIso(Number(y), Number(m), Number(d));
  }

  // Formato chileno DD/MM/(YY|YYYY) con separadores / - .
  const m = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if (m) {
    const [, d, mo, ySource] = m;
    let y = ySource;
    if (y.length === 2) {
      const n = Number(y);
      y = String(n < 50 ? 2000 + n : 1900 + n);
    }
    return buildIso(Number(y), Number(mo), Number(d));
  }

  // Formato corto DD/MM (sin año) — asumimos el año de referencia (default: hoy).
  const short = trimmed.match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
  if (short) {
    const [, d, mo] = short;
    const y = referenceYear ?? new Date().getFullYear();
    return buildIso(y, Number(mo), Number(d));
  }

  // 8 dígitos seguidos: DDMMYYYY o YYYYMMDD.
  const eight = trimmed.match(/^(\d{8})$/);
  if (eight) {
    const s = eight[1];
    // Si arranca con 19/20, lo tratamos como YYYYMMDD; si no, como DDMMYYYY.
    if (s.startsWith("19") || s.startsWith("20")) {
      return buildIso(Number(s.slice(0, 4)), Number(s.slice(4, 6)), Number(s.slice(6, 8)));
    }
    return buildIso(Number(s.slice(4, 8)), Number(s.slice(2, 4)), Number(s.slice(0, 2)));
  }

  return null;
}

/**
 * Toma cualquier valor de fecha que haya devuelto la IA (o el usuario) y lo
 * intenta normalizar al formato chileno canónico `DD-MM-YYYY`.
 *
 * Si no puede interpretarlo, devuelve el valor original sin tocar (para no
 * perder lo que escribió la persona). Esta función NO hace round-trip por
 * ISO si ya viene en `DD-MM-YYYY`.
 *
 * Si la fecha extraída solo trae día y mes, se completa con `referenceYear`
 * (por defecto el año actual del servidor).
 */
export function formatExtractedDateChilean(
  value: string | undefined | null,
  referenceYear?: number
): string {
  if (!value) return "";
  const iso = parseToIso(value, referenceYear);
  if (iso) return formatChileanDate(iso);
  return value.trim();
}

export function maskChileanDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  if (digits.length <= 2) return day;
  if (digits.length <= 4) return `${day}-${month}`;
  return `${day}-${month}-${year}`;
}

export function normalizeChileanDate(value: string): string {
  const iso = parseToIso(value);
  return iso ? formatChileanDate(iso) : value.trim();
}

function buildIso(
  year: number,
  month: number,
  day: number
): string | null {
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (year < 1900 || year > 2200) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
}

/**
 * Formatea una fecha ISO `YYYY-MM-DD` a "DD/MM/YYYY" estilo chileno.
 * Si el input no es ISO válido lo devuelve sin cambios.
 */
export function formatChileanDate(iso: string | undefined | null): string {
  if (!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const [, y, mo, d] = m;
  return `${d}-${mo}-${y}`;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

function pad4(n: number): string {
  return n.toString().padStart(4, "0");
}
