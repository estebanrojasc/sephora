import { Badge } from "@/components/ui/badge";
import type { BitacoraRowType } from "@/features/bitacora/types";

const LABELS: Record<BitacoraRowType, string> = {
  ruta: "Ruta",
  entrega_pendiente: "Entrega pendiente",
  manual: "Manual",
  totals: "Totales",
  header: "Encabezado",
  unknown: "Desconocido",
};

const VARIANTS: Record<
  BitacoraRowType,
  "default" | "secondary" | "destructive" | "outline"
> = {
  ruta: "default",
  entrega_pendiente: "destructive",
  manual: "secondary",
  totals: "outline",
  header: "outline",
  unknown: "outline",
};

export function BitacoraRowBadge({
  rowType,
  manualSubtype,
}: {
  rowType: BitacoraRowType;
  manualSubtype?: string;
}) {
  const label =
    rowType === "manual" && manualSubtype
      ? manualSubtype.replace(/_/g, " ")
      : LABELS[rowType];
  return (
    <Badge variant={VARIANTS[rowType]} className="text-[10px] capitalize">
      {label}
    </Badge>
  );
}
