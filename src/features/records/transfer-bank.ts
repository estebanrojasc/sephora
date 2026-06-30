/** Códigos de banco en transferencias (OCR / matching). */
export const TRANSFER_BANK_CODES = ["E", "VE", "S"] as const;
export type TransferBankCode = (typeof TRANSFER_BANK_CODES)[number];

export const TRANSFER_BANK_DISPLAY: Record<TransferBankCode, string> = {
  E: "Banco Estado",
  VE: "Voucher Banco Estado",
  S: "Banco Santander",
};

/**
 * Normaliza lo leído por OCR a E, VE o S.
 * V suelto → VE. Nombres completos → código. Desconocido → "".
 */
export function normalizeTransferBankCode(raw: string): string {
  const v = raw.trim();
  if (!v) return "";

  const upper = v.toUpperCase().replace(/\./g, "").replace(/\s+/g, " ");

  if (upper === "E" || upper === "VE" || upper === "S") return upper;
  if (upper === "V") return "VE";

  if (
    upper === "SANTANDER" ||
    upper === "BANCO SANTANDER" ||
    upper === "SAN" ||
    upper === "BS"
  ) {
    return "S";
  }

  if (
    upper === "ESTADO" ||
    upper === "BANCO ESTADO" ||
    upper === "BE" ||
    upper === "BANCOESTADO"
  ) {
    return "E";
  }

  if (
    upper === "VOUCHER" ||
    upper.includes("VOUCHER") ||
    upper === "VOUCHER BE" ||
    upper === "VOUCHER BANCO ESTADO"
  ) {
    return "VE";
  }

  return "";
}

export function applyTransferBankToField(valor: string): string {
  return normalizeTransferBankCode(valor);
}

/** Nombre legible para revisión, Excel y reportes (nunca solo la letra). */
export function transferBankDisplayLabel(raw: string): string {
  const v = raw.trim();
  if (!v) return "";
  const code = normalizeTransferBankCode(v);
  if (code && code in TRANSFER_BANK_DISPLAY) {
    return TRANSFER_BANK_DISPLAY[code as TransferBankCode];
  }
  return v;
}
