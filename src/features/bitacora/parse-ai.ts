import "server-only";
import { isGeminiConfigured } from "@/features/vision/config";
import { VisionProviderError } from "@/features/vision/errors";
import {
  BITACORA_SYSTEM_PROMPT,
  buildBitacoraUserPrompt,
} from "./prompts";
import { buildBitacoraGeminiSchema } from "./gemini-schema";
import { parseBitacoraFromText } from "./normalize";
import type { ParseBitacoraResult } from "./types";

const DEFAULT_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export interface BitacoraParseResult {
  result: ParseBitacoraResult;
  rawResponse: string;
  model: string;
  provider: "gemini";
}

export function isBitacoraAIParseConfigured(): boolean {
  return isGeminiConfigured();
}

export async function parseBitacoraWithAI(
  rawPaste: string
): Promise<BitacoraParseResult> {
  if (!isGeminiConfigured()) {
    throw new Error(
      "GEMINI_API_KEY no configurada (bitácora usa el mismo proveedor que el reconocimiento)"
    );
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new VisionProviderError({
      provider: "gemini",
      kind: "config",
      message: "GEMINI_API_KEY no configurada",
    });
  }

  const baseUrl = process.env.GEMINI_BASE_URL ?? DEFAULT_GEMINI_BASE;
  const model = process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
  const userPrompt = buildBitacoraUserPrompt(rawPaste);

  const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: BITACORA_SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: buildBitacoraGeminiSchema(),
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new VisionProviderError({
      provider: "gemini",
      kind: "http",
      status: response.status,
      message: `Gemini API ${response.status}: ${text.slice(0, 300)}`,
    });
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return {
    result: parseBitacoraFromText(content),
    rawResponse: content,
    model,
    provider: "gemini",
  };
}
