import { isChequeAlDia, splitChequesByTipo } from "../src/features/records/cheque-utils.ts";
import { parseToIso } from "../src/lib/date-utils.ts";

const ref = "2026-06-30";
const cases = [
  ["30-07-2026", false],
  ["30/07/2026", false],
  ["30-06-2026", true],
  ["30/06/2026", true],
  ["29-06-2026", true],
  ["01-07-2026", false],
  ["30-07", false],
  ["30-06", true],
];

for (const [fecha, expectAlDia] of cases) {
  const got = isChequeAlDia(fecha, ref);
  const iso = parseToIso(fecha, 2026);
  console.log(
    got === expectAlDia ? "OK" : "FAIL",
    fecha,
    "iso=",
    iso,
    "alDia=",
    got,
    "expected",
    expectAlDia
  );
}
