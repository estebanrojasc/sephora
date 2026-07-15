import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  BitacoraDeleteBlockedError,
  deleteBitacoraRow,
  deleteBitacoraVersion,
  findBitacoraById,
  replaceActiveBitacoraContents,
  updateBitacoraRow,
} from "@/lib/repositories/bitacoras";
import { BITACORA_ROW_EDITABLE_FIELDS } from "@/features/bitacora/row-patch";
import { jsonNoStore } from "@/lib/api-response";
import { mongoErrorResponse } from "@/lib/api-mongo-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const optionalString = z.string().optional();

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
  linkedRecordIds: z.array(z.string()).optional(),
  allowsMultipleReviews: z.boolean().optional(),
});

const putSchema = z.object({
  title: z.string().optional(),
  rows: z.array(rowSchema).min(1),
  rawPaste: z.string().min(1),
});

const patchRowSchema = z
  .object({
    rowId: z.string().uuid(),
    allowsMultipleReviews: z.boolean().optional(),
    rowType: z
      .enum([
        "ruta",
        "entrega_pendiente",
        "manual",
        "totals",
        "header",
        "unknown",
      ])
      .optional(),
    manualSubtype: optionalString,
    scheduledDate: z.union([
      z
        .string()
        .regex(
          /^\d{4}-\d{2}-\d{2}$/,
          "Fecha programada inválida (use AAAA-MM-DD)"
        ),
      z.literal(""),
    ]).optional(),
    territorio: optionalString,
    anden: optionalString,
    patente: optionalString,
    conductor: optionalString,
    auxiliar: optionalString,
    observacion: optionalString,
    sector: optionalString,
    recorrido: optionalString,
    recorridoSuffix: optionalString,
    primerFolio: optionalString,
    ultimoFolio: optionalString,
    cantFact: optionalString,
    puntos: optionalString,
    montoTotal: optionalString,
  })
  .refine(
    (data) =>
      data.allowsMultipleReviews !== undefined ||
      BITACORA_ROW_EDITABLE_FIELDS.some(
        (key) => data[key as keyof typeof data] !== undefined
      ),
    { message: "Nada que actualizar" }
  );

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bitacora = await findBitacoraById(id);
  if (!bitacora) {
    return NextResponse.json(
      { message: "Bitácora no encontrada" },
      { status: 404 }
    );
  }
  return jsonNoStore(bitacora);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const bitacora = await findBitacoraById(id);
  if (!bitacora) {
    return NextResponse.json(
      { message: "Bitácora no encontrada" },
      { status: 404 }
    );
  }
  if (!bitacora.isActive) {
    return NextResponse.json(
      { message: "Solo se puede editar la versión activa" },
      { status: 400 }
    );
  }

  const updated = await replaceActiveBitacoraContents(id, parsed.data);
  if (!updated) {
    return NextResponse.json(
      { message: "No se pudo actualizar la bitácora" },
      { status: 500 }
    );
  }
  return jsonNoStore(updated);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = patchRowSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const bitacora = await findBitacoraById(id);
  if (!bitacora) {
    return NextResponse.json(
      { message: "Bitácora no encontrada" },
      { status: 404 }
    );
  }

  const row = bitacora.rows.find((r) => r.id === parsed.data.rowId);
  if (!row) {
    return NextResponse.json({ message: "Fila no encontrada" }, { status: 404 });
  }

  const { rowId, ...patch } = parsed.data;
  const normalized = { ...patch };
  if (normalized.scheduledDate === "") {
    normalized.scheduledDate = undefined;
  }

  const updated = await updateBitacoraRow(id, rowId, normalized);
  if (!updated) {
    return NextResponse.json(
      { message: "No se pudo actualizar la fila" },
      { status: 500 }
    );
  }

  return jsonNoStore(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const rowId = request.nextUrl.searchParams.get("rowId");

  try {
    if (rowId) {
      const updated = await deleteBitacoraRow(id, rowId);
      if (!updated) {
        return NextResponse.json(
          { message: "Bitácora o fila no encontrada" },
          { status: 404 }
        );
      }
      return jsonNoStore(updated);
    }

    const result = await deleteBitacoraVersion(id);
    return jsonNoStore({
      ok: true,
      deletedId: result.deleted.id,
      date: result.deleted.date,
      reactivatedId: result.reactivatedId,
    });
  } catch (err) {
    if (err instanceof BitacoraDeleteBlockedError) {
      return NextResponse.json(
        { message: err.message, blockingRecordIds: err.blockingRecordIds },
        { status: err.message.includes("no encontrada") ? 404 : 409 }
      );
    }
    return mongoErrorResponse(err, "api/bitacora/[id] DELETE");
  }
}
