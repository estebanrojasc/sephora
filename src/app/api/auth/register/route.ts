import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  countUsers,
  createUser,
  findUserByEmail,
} from "@/lib/repositories/users";
import { setSessionCookie, signSessionToken } from "@/lib/auth/session";

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "La contraseña debe tener al menos 8 caracteres"),
  name: z.string().min(2, "El nombre es obligatorio"),
  registrationKey: z.string().min(1, "Falta la clave de registro"),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const expectedKey = process.env.ADMIN_REGISTRATION_KEY;
  if (!expectedKey) {
    return NextResponse.json(
      {
        message:
          "El servidor no tiene configurada ADMIN_REGISTRATION_KEY. Pide al sysadmin que la agregue a .env.local.",
      },
      { status: 503 }
    );
  }

  if (parsed.data.registrationKey !== expectedKey) {
    return NextResponse.json(
      { message: "Clave de registro inválida" },
      { status: 403 }
    );
  }

  const existing = await findUserByEmail(parsed.data.email);
  if (existing) {
    return NextResponse.json(
      { message: "Ese email ya está registrado" },
      { status: 409 }
    );
  }

  const created = await createUser({
    email: parsed.data.email,
    password: parsed.data.password,
    name: parsed.data.name,
  });

  const token = await signSessionToken({
    userId: created.id,
    email: created.email,
    name: created.name,
    role: "admin",
  });
  await setSessionCookie(token);

  const total = await countUsers();
  return NextResponse.json({ user: created, totalAdmins: total });
}
