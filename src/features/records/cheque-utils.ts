import { parseToIso, todayIsoDateChile } from "@/lib/date-utils";
import type { ChequeRow } from "@/features/records/types";

/** Cheques de hoy o fechas anteriores son "al día"; el resto son "a fecha". */
export function isChequeAlDia(
  fechaValor: string,
  todayIso = todayIsoDateChile()
): boolean {
  const iso = parseToIso(fechaValor);
  if (!iso) return false;
  return iso <= todayIso;
}

export function splitChequesByTipo(
  cheques: ChequeRow[],
  todayIso = todayIsoDateChile()
): { alDia: ChequeRow[]; aFecha: ChequeRow[] } {
  const alDia: ChequeRow[] = [];
  const aFecha: ChequeRow[] = [];
  for (const row of cheques) {
    if (isChequeAlDia(row.fecha.valor, todayIso)) {
      alDia.push(row);
    } else {
      aFecha.push(row);
    }
  }
  return { alDia, aFecha };
}
