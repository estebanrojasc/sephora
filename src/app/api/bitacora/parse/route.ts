import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { gridToHeuristicRows } from "@/features/bitacora/heuristics";
import {
  isBitacoraAIParseConfigured,
  parseBitacoraWithAI,
} from "@/features/bitacora/parse-ai";
import { parseClipboardToGrid } from "@/features/bitacora/parse-tsv";
import { todayIsoDateChile } from "@/lib/date-utils";

const bodySchema = z.object({
  rawPaste: z.string().min(1),
  /** Solo true cuando el usuario pide explícitamente refino con IA. */
  useAi: z.boolean().optional(),
});

function heuristicResponse(rawPaste: string) {
  const grid = parseClipboardToGrid(rawPaste);
  const heuristic = gridToHeuristicRows(grid);
  return {
    date: heuristic.date ?? todayIsoDateChile(),
    title: heuristic.title,
    rows: heuristic.rows,
    warnings: heuristic.warnings,
    provider: "heuristic" as const,
  };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { message: "Se requiere rawPaste" },
      { status: 400 }
    );
  }

  const { rawPaste, useAi } = parsed.data;

  if (useAi && isBitacoraAIParseConfigured()) {
    try {
      const ai = await parseBitacoraWithAI(rawPaste);
      return NextResponse.json({
        ...ai.result,
        provider: ai.provider,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error desconocido";
      console.warn("[bitacora/parse] IA falló, usando heurísticas:", message);
      const fallback = heuristicResponse(rawPaste);
      return NextResponse.json({
        ...fallback,
        warnings: [...fallback.warnings, `IA no pudo refinar: ${message}`],
      });
    }
  }

  if (useAi && !isBitacoraAIParseConfigured()) {
    const fallback = heuristicResponse(rawPaste);
    return NextResponse.json({
      ...fallback,
      warnings: [...fallback.warnings, "GEMINI_API_KEY no configurada; se mantuvo el parseo local."],
    });
  }

  return NextResponse.json(heuristicResponse(rawPaste));
}
