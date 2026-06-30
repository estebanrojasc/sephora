import type { CreateCatalogPayload } from "./types";

/** Catálogos creados al primer acceso si aún no existen en la base. */
export const DEFAULT_CATALOGS: CreateCatalogPayload[] = [
  {
    name: "Banco transferencia",
    fieldKey: "detalle_transferencias.banco",
    active: true,
    items: [
      {
        id: "transfer-bank-e",
        value: "Banco Estado",
        aliases: ["E", "Estado", "BE", "BancoEstado"],
      },
      {
        id: "transfer-bank-ve",
        value: "Voucher Banco Estado",
        aliases: ["VE", "V", "Voucher", "Voucher BE"],
      },
      {
        id: "transfer-bank-s",
        value: "Banco Santander",
        aliases: ["S", "Santander", "SAN", "BS"],
      },
    ],
  },
];
