/** Códigos de banco en transferencias (únicos valores válidos). */
export const TRANSFER_BANK_CODES = ["E", "VE", "S"] as const;
export type TransferBankCode = (typeof TRANSFER_BANK_CODES)[number];

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
