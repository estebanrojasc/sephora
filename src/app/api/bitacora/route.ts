import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createBitacoraVersion,
  listBitacoras,
} from "@/lib/repositories/bitacoras";
import { jsonNoStore } from "@/lib/api-response";
import { mongoErrorResponse } from "@/lib/api-mongo-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const rowSchema = z.object({
  id: z.string(),
  rowType: z.enum([
    "ruta",
    "entrega_pendiente",
    "manual",
    "totals",
    "header",
    "unknown",
  ]),
  manualSubtype: z.string().optional(),
  territorio: z.string().optional(),
  anden: z.string().optional(),
  patente: z.string().optional(),
  conductor: z.string().optional(),
  auxiliar: z.string().optional(),
  observacion: z.string().optional(),
  sector: z.string().optional(),
  recorrido: z.string().optional(),
  recorridoSuffix: z.string().optional(),
  primerFolio: z.string().optional(),
  ultimoFolio: z.string().optional(),
  cantFact: z.string().optional(),
  puntos: z.string().optional(),
  montoTotal: z.string().optional(),
  scheduledDate: z.string().optional(),
  linkedRecordId: z.string().optional(),
});

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().optional(),
  rows: z.array(rowSchema).min(1),
  rawPaste: z.string().min(1),
  aiProvider: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const date = searchParams.get("date") ?? undefined;
    const activeOnly = searchParams.get("active") === "1";
    const bitacoras = await listBitacoras({ date, activeOnly });
    return jsonNoStore(bitacoras);
  } catch (err) {
    return mongoErrorResponse(err, "api/bitacora");
  }
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
  const created = await createBitacoraVersion(parsed.data);
  return jsonNoStore(created, { status: 201 });
}
