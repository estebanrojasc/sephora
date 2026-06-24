import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  deleteCatalog,
  findCatalogById,
  updateCatalog,
} from "@/lib/repositories/catalogs";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  fieldKey: z.string().min(1).optional(),
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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const catalog = await findCatalogById(id);
  if (!catalog) {
    return NextResponse.json(
      { message: "Catálogo no encontrado" },
      { status: 404 }
    );
  }
  return NextResponse.json(catalog);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }
  const updated = await updateCatalog(id, parsed.data);
  if (!updated) {
    return NextResponse.json(
      { message: "Catálogo no encontrado" },
      { status: 404 }
    );
  }
  return NextResponse.json(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = await deleteCatalog(id);
  if (!ok) {
    return NextResponse.json(
      { message: "Catálogo no encontrado" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
