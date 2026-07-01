import Link from "next/link";

export function BitacoraDayList({ dates }: { dates: string[] }) {
  if (dates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aún no hay bitácoras guardadas.
      </p>
    );
  }
  return (
    <ul className="divide-y rounded-md border">
      {dates.map((d) => (
        <li key={d}>
          <Link
            href={`/admin/bitacora/${d}`}
            className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/50"
          >
            <span className="font-medium">{d}</span>
            <span className="text-xs text-muted-foreground">Ver →</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
