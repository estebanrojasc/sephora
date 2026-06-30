/**
 * Fetch JSON sin caché (navegador / CDN Vercel). Evita 304 con payload obsoleto.
 */
export async function fetchJsonNoStore<T>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const busted = new URL(
    url,
    typeof window !== "undefined" ? window.location.origin : "http://localhost"
  );
  busted.searchParams.set("_", String(Date.now()));

  const res = await fetch(busted.toString(), {
    ...init,
    credentials: init?.credentials ?? "include",
    cache: "no-store",
    headers: {
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
      ...(init?.headers instanceof Headers
        ? Object.fromEntries(init.headers.entries())
        : (init?.headers as Record<string, string> | undefined)),
    },
  });

  if (res.status === 304) {
    const retry = await fetch(busted.toString(), {
      ...init,
      credentials: init?.credentials ?? "include",
      cache: "reload",
      headers: {
        "Cache-Control": "no-cache, no-store",
        Pragma: "no-cache",
        ...(init?.headers instanceof Headers
          ? Object.fromEntries(init.headers.entries())
          : (init?.headers as Record<string, string> | undefined)),
      },
    });
    if (retry.ok) return retry.json() as Promise<T>;
    throw new Error(
      "Datos en caché obsoletos (304). Recarga con Ctrl+F5 o espera unos segundos."
    );
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(
      (data as { message?: string }).message ?? `Error ${res.status}`
    );
  }
  return res.json() as Promise<T>;
}
