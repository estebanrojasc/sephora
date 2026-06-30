/**
 * Catálogos editables por el administrador para estandarizar respuestas de la
 * IA. Cada catálogo se vincula a un `fieldKey` (clave puntiaguda del JSON de
 * extracción) y cuando está activo, los inputs correspondientes muestran un
 * selector con los valores válidos.
 */

export interface CatalogItem {
  id: string;
  value: string;
  /** Sinónimos opcionales (los que la IA podría escribir distinto). */
  aliases?: string[];
}

export interface Catalog {
  id: string;
  name: string;
  /**
   * Clave del campo en la extracción a la que se vincula.
   * Ejemplos: "conductor", "auxiliar", "detalles_cheques.banco".
   * Soporta notación dot para campos anidados de arrays (la primera parte es
   * el nombre del array y la segunda el campo dentro de cada fila).
   */
  fieldKey: string;
  /** Cuando false, no se aplica en los inputs de revisión. */
  active: boolean;
  items: CatalogItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCatalogPayload {
  name: string;
  fieldKey: string;
  active?: boolean;
  items?: CatalogItem[];
}

export interface UpdateCatalogPayload {
  name?: string;
  fieldKey?: string;
  active?: boolean;
  items?: CatalogItem[];
}

/**
 * Lista de campos válidos como `fieldKey`. Sirve para el selector de la UI de
 * gestión. Refleja los campos del schema que entrega la IA y que vale la pena
 * estandarizar. Se puede ampliar a medida que crezca el esquema.
 *
 * `group` agrupa visualmente las opciones; no tiene impacto en la lógica.
 */
export interface CatalogFieldOption {
  value: string;
  label: string;
  group: string;
}

export const CATALOG_FIELD_KEYS: CatalogFieldOption[] = [
  // Cabecera del documento
  { group: "Encabezado", value: "conductor", label: "Conductor" },
  { group: "Encabezado", value: "auxiliar", label: "Auxiliar" },
  { group: "Encabezado", value: "patente", label: "Patente" },
  { group: "Encabezado", value: "n_recorrido", label: "Nº Recorrido" },

  // Detalle de cheques (fila por cheque)
  { group: "Cheques", value: "detalles_cheques.banco", label: "Cheques · Banco" },

  // Notas de crédito (fila por NC)
  {
    group: "Notas de crédito",
    value: "n_c_rechazo_total.no_fac",
    label: "NC rechazo total · Nº factura",
  },
  {
    group: "Notas de crédito",
    value: "n_c_rechazo_parcial.no_fac",
    label: "NC rechazo parcial · Nº factura",
  },
  {
    group: "Notas de crédito",
    value: "n_c_por_negocios.no_fac",
    label: "NC por negocios · Nº factura",
  },
  {
    group: "Transferencias",
    value: "detalle_transferencias.no_fac",
    label: "Transferencias · Nº factura",
  },
  {
    group: "Crédito vendedor",
    value: "detalle_credito_vendedor.no_fac",
    label: "Crédito vendedor · Nº factura",
  },

  // Detalle de efectivo (denominaciones)
  {
    group: "Efectivo",
    value: "detalle_efectivo.billetes.denominacion",
    label: "Billetes · Denominación",
  },
];

/** Devuelve la opción para una key dada (o null si no está catalogada). */
export function findCatalogFieldOption(key: string): CatalogFieldOption | null {
  return CATALOG_FIELD_KEYS.find((f) => f.value === key) ?? null;
}
