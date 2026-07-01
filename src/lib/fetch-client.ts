export class ApiFetchError extends Error {
  readonly status: number;
  readonly url: string;
  readonly body: unknown;

  constructor(status: number, url: string, body: unknown) {
    const b = body as { message?: string; detail?: string; error?: string };
    const parts = [
      `HTTP ${status}`,
      b.message,
      b.detail,
      b.error,
    ].filter(Boolean);
    super(parts.join(" — ") || `Error ${status}`);
    this.name = "ApiFetchError";
    this.status = status;
    this.url = url;
    this.body = body;
  }
}

/**
 * Fetch JSON sin caché (navegador / CDN). Errores incluyen status + detalle del servidor.
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
    throw new ApiFetchError(304, url, {
      message: "Respuesta 304 en caché. Recarga con Ctrl+F5.",
    });
  }

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { message: text.slice(0, 500) || res.statusText };
  }

  if (!res.ok) {
    throw new ApiFetchError(res.status, url, body);
  }

  return body as T;
}
