import { format, formatDistanceToNow, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export function formatDate(iso: string) {
  try {
    return format(parseISO(iso), "dd MMM yyyy, HH:mm", { locale: es });
  } catch {
    return iso;
  }
}

export function formatDateShort(iso: string) {
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: es });
  } catch {
    return iso;
  }
}

export function formatRelative(iso: string) {
  try {
    return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: es });
  } catch {
    return iso;
  }
}

export function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}
