import { faker } from "@faker-js/faker/locale/es";
import {
  createEmptyExtraction,
  type Bbox,
  type ExtractedField,
  type Extraction,
} from "@/features/records/types";
import { formatExtractedDateChilean } from "@/lib/date-utils";

function randBbox(): Bbox {
  const x = faker.number.int({ min: 50, max: 800 });
  const y = faker.number.int({ min: 50, max: 800 });
  return [x, y, x + 120, y + 30];
}

function f(valor: string): ExtractedField {
  return { valor, bbox: randBbox() };
}

/**
 * Devuelve una extracción simulada (sin llamar a Qwen) para demos sin API key.
 */
export function mockExtractionFromImage(): Extraction {
  const base = createEmptyExtraction();
  return {
    ...base,
    fecha: f(
      formatExtractedDateChilean(
        faker.date.recent({ days: 4 }).toISOString().slice(0, 10)
      )
    ),
    conductor: f(faker.person.fullName()),
    auxiliar: f(faker.person.fullName()),
    n_recorrido: f(String(faker.number.int({ min: 100, max: 999 }))),
    patente: f(
      `${faker.string.alpha({ length: 2 }).toUpperCase()}-${faker.string.alpha({ length: 2 }).toUpperCase()}-${faker.number.int({ min: 10, max: 99 })}`
    ),
    cant_fact: f(String(faker.number.int({ min: 3, max: 25 }))),
    valor_total: f(`$${faker.number.int({ min: 100000, max: 2000000 })}`),
    rendicion: {
      ...base.rendicion,
      efectivo_total: f(`$${faker.number.int({ min: 50000, max: 500000 })}`),
      cheques_al_dia: f(`$${faker.number.int({ min: 0, max: 300000 })}`),
      transferencia: f(`$${faker.number.int({ min: 0, max: 500000 })}`),
      total: f(`$${faker.number.int({ min: 100000, max: 2000000 })}`),
    },
    detalles_cheques: Array.from(
      { length: faker.number.int({ min: 0, max: 3 }) },
      () => ({
        fecha: f(
          formatExtractedDateChilean(
            faker.date.soon({ days: 30 }).toISOString().slice(0, 10)
          )
        ),
        banco: f(faker.helpers.arrayElement(["BCI", "Estado", "Santander", "Chile", "Falabella"])),
        valor: f(`$${faker.number.int({ min: 10000, max: 200000 })}`),
      })
    ),
    detalle_transferencias: Array.from(
      { length: faker.number.int({ min: 0, max: 2 }) },
      () => ({
        no_fac: f(String(faker.number.int({ min: 100000, max: 999999 }))),
        cliente: f(faker.person.fullName()),
        valor: f(`$${faker.number.int({ min: 5000, max: 150000 })}`),
      })
    ),
    detalle_efectivo: {
      billetes: Array.from(
        { length: faker.number.int({ min: 0, max: 4 }) },
        () => ({
          denominacion: f(
            faker.helpers.arrayElement(["1000", "2000", "5000", "10000", "20000"])
          ),
          valor: f(`$${faker.number.int({ min: 1000, max: 100000 })}`),
        })
      ),
      total_efectivo: f(`$${faker.number.int({ min: 50000, max: 500000 })}`),
    },
    observaciones: f(faker.lorem.sentence()),
  };
}
