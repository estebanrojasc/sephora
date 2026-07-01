import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  findBitacoraById,
  updateBitacoraRow,
} from "@/lib/repositories/bitacoras";
import { PENDING_DELIVERY_EDITABLE_FIELDS } from "@/features/bitacora/row-patch";
import { jsonNoStore } from "@/lib/api-response";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const optionalString = z.string().optional();

const patchRowSchema = z
  .object({
    rowId: z.string().uuid(),
    allowsMultipleReviews: z.boolean().optional(),
    scheduledDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha programada inválida (use AAAA-MM-DD)")
      .optional(),
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
      PENDING_DELIVERY_EDITABLE_FIELDS.some(
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

  const hasPendingFields = PENDING_DELIVERY_EDITABLE_FIELDS.some(
    (key) => parsed.data[key as keyof typeof parsed.data] !== undefined
  );
  if (hasPendingFields && row.rowType !== "entrega_pendiente") {
    return NextResponse.json(
      {
        message:
          "Solo las filas de entrega pendiente admiten edición de datos desde aquí",
      },
      { status: 400 }
    );
  }

  const { rowId, ...patch } = parsed.data;
  const updated = await updateBitacoraRow(id, rowId, patch);
  if (!updated) {
    return NextResponse.json(
      { message: "No se pudo actualizar la fila" },
      { status: 500 }
    );
  }

  return jsonNoStore(updated);
}
