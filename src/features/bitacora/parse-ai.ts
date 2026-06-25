import "server-only";
import {
  isGeminiConfigured,
  isQwenConfigured,
  resolveVisionProvider,
} from "@/features/vision/config";
import { VisionProviderError } from "@/features/vision/errors";
import type { VisionProvider } from "@/features/vision/types";
import {
  BITACORA_JSON_TEMPLATE,
  BITACORA_SYSTEM_PROMPT,
  buildBitacoraUserPrompt,
} from "./prompts";
import { buildBitacoraGeminiSchema } from "./gemini-schema";
import { parseBitacoraFromText } from "./normalize";
import type { ParseBitacoraResult } from "./types";

const DEFAULT_GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_QWEN_BASE =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const DEFAULT_QWEN_MODEL = "qwen3-vl-flash";

export interface BitacoraParseResult {
  result: ParseBitacoraResult;
  rawResponse: string;
  model: string;
  provider: VisionProvider;
}

async function parseWithGemini(rawPaste: string): Promise<BitacoraParseResult> {
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

async function parseWithQwen(rawPaste: string): Promise<BitacoraParseResult> {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    throw new VisionProviderError({
      provider: "qwen",
      kind: "config",
      message: "QWEN_API_KEY no configurada",
    });
  }

  const baseUrl = process.env.QWEN_BASE_URL ?? DEFAULT_QWEN_BASE;
  const model = process.env.QWEN_MODEL ?? DEFAULT_QWEN_MODEL;
  const userPrompt = `${buildBitacoraUserPrompt(rawPaste)}

Estructura exacta:
${BITACORA_JSON_TEMPLATE}`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: BITACORA_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new VisionProviderError({
      provider: "qwen",
      kind: "http",
      status: response.status,
      message: `Qwen API ${response.status}: ${text.slice(0, 300)}`,
    });
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  return {
    result: parseBitacoraFromText(content),
    rawResponse: content,
    model,
    provider: "qwen",
  };
}

export function isBitacoraAIParseConfigured(): boolean {
  return isGeminiConfigured() || isQwenConfigured();
}

export async function parseBitacoraWithAI(
  rawPaste: string
): Promise<BitacoraParseResult> {
  const provider = resolveVisionProvider();
  if (!provider) {
    throw new Error("No hay proveedor de IA configurado");
  }
  return provider === "gemini"
    ? parseWithGemini(rawPaste)
    : parseWithQwen(rawPaste);
}
