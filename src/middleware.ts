import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { applyNoStoreHeaders } from "@/lib/no-cache-headers";

/**
 * Protege rutas administrativas usando JWT en cookie.
 *
 * NOTA: el middleware corre en Edge runtime, por eso no podemos importar
 * el helper de Node (`@/lib/auth/session`) y duplicamos el verify aquí.
 */

const AUTH_COOKIE = "qwen-visor-auth";

/** Endpoints API que cualquier conductor puede llamar sin login. */
const PUBLIC_API_PREFIXES = [
  "/api/auth/",
  "/api/records/upload",
];

/** Endpoints API que admiten lectura por el driver (su propio device). */
const SEMIPUBLIC_API_PREFIXES = [
  "/api/records", // listar/leer registros propios
];

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) return false;
  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );
    return payload?.role === "admin";
  } catch {
    return false;
  }
}

function isPathProtected(pathname: string): boolean {
  // Páginas /admin/* siempre protegidas
  if (pathname.startsWith("/admin")) return true;

  // Mutaciones de API protegidas (PATCH, DELETE), pero como el middleware no
  // diferencia por método sin pagar performance, sólo bloqueamos APIs
  // explícitas de catálogos. Records sigue permitiendo GET para el driver
  // y la app valida en endpoint específico.
  if (pathname.startsWith("/api/catalogs")) return true;
  if (pathname.startsWith("/api/bitacora")) return true;
  if (pathname === "/api/records/from-bitacora") return true;
  if (pathname.startsWith("/api/records/") && pathname.endsWith("/process-ai")) {
    return true;
  }
  if (pathname.startsWith("/api/records/") && pathname.endsWith("/extraction")) {
    return true;
  }
  if (pathname.startsWith("/api/records/") && pathname.endsWith("/status")) {
    return true;
  }
  if (pathname.startsWith("/api/records/") && pathname.endsWith("/excel")) {
    return true;
  }
  if (pathname === "/api/records/excel/bulk") {
    return true;
  }
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isRsc =
    request.nextUrl.searchParams.has("_rsc") ||
    request.headers.get("RSC") === "1" ||
    request.headers.get("Next-Router-Prefetch") === "1";

  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    const response = NextResponse.next();
    if (isRsc) applyNoStoreHeaders(response);
    return response;
  }

  if (!isPathProtected(pathname)) {
    void SEMIPUBLIC_API_PREFIXES;
    return NextResponse.next();
  }

  const authorized = await isAuthorized(request);
  if (authorized) {
    const requestHeaders = new Headers(request.headers);
    // Evita 304 del segment cache / CDN cuando el payload RSC quedó obsoleto.
    if (isRsc || pathname.startsWith("/admin")) {
      requestHeaders.delete("if-none-match");
      requestHeaders.delete("if-modified-since");
      requestHeaders.set("Cache-Control", "no-cache, no-store, must-revalidate");
      requestHeaders.set("Pragma", "no-cache");
    }
    const response = NextResponse.next({
      request: { headers: requestHeaders },
    });
    if (
      pathname.startsWith("/admin") ||
      pathname.startsWith("/api/bitacora") ||
      pathname.startsWith("/api/records") ||
      isRsc
    ) {
      applyNoStoreHeaders(response);
      response.headers.delete("etag");
      response.headers.set("x-middleware-cache", "no-cache");
    }
    return response;
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ message: "No autenticado" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/:path*"],
};
