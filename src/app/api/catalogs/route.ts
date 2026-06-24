import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createCatalog,
  listCatalogs,
} from "@/lib/repositories/catalogs";

const createSchema = z.object({
  name: z.string().min(1),
  fieldKey: z.string().min(1),
  active: z.boolean().optional(),
  items: z
    .array(
      z.object({
        id: z.string(),
        value: z.string().min(1),
        aliases: z.array(z.string()).optional(),
      })
    )
    .optional(),
});

export async function GET() {
  const catalogs = await listCatalogs();
  return NextResponse.json(catalogs);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const created = await createCatalog(parsed.data);
  return NextResponse.json(created, { status: 201 });
}
