import "server-only";
import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "./session";

/** Devuelve la sesión o lanza 401 lista para retornar desde una route handler. */
export async function requireSession(): Promise<
  { session: SessionPayload } | { error: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return {
      error: NextResponse.json(
        { message: "No autenticado" },
        { status: 401 }
      ),
    };
  }
  return { session };
}
