import type { CreateCatalogPayload } from "./types";

/** Catálogo sugerido: códigos de banco en transferencias. */
export const DEFAULT_TRANSFER_BANK_CATALOG: CreateCatalogPayload = {
  name: "Códigos banco · transferencias",
  fieldKey: "detalle_transferencias.banco",
  active: true,
  items: [
    {
      id: "tb-ve",
      value: "VE",
      aliases: [
        "V",
        "VOUCHER",
        "VOUCHER BE",
        "VOUCHER BANCO ESTADO",
        "BANCO ESTADO VOUCHER",
      ],
    },
    {
      id: "tb-e",
      value: "E",
      aliases: ["BE", "BANCO ESTADO", "ESTADO", "B.E."],
    },
    {
      id: "tb-s",
      value: "S",
      aliases: ["SAN", "SANTANDER", "BANCO SANTANDER", "B.S."],
    },
  ],
};

export const DEFAULT_CATALOGS: CreateCatalogPayload[] = [
  DEFAULT_TRANSFER_BANK_CATALOG,
];
