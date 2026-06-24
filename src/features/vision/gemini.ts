import "server-only";
import {
  buildInitialUserPrompt,
  buildMergeUserPrompt,
  SYSTEM_PROMPT,
} from "./prompts";
import { parseExtractionFromText, swapBboxAxes } from "./normalize";
import { buildGeminiExtractionSchema } from "./gemini-schema";
import { parseOptionalBoolean } from "./config";
import {
  VisionProviderError,
  kindFromStatus,
  parseRetryAfterMs,
} from "./errors";
import type { VisionExtractOptions, VisionExtractResult } from "./types";

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
// Modelo multimodal estable y barato en 2026 (las series 1.x fueron retiradas).
const DEFAULT_MODEL = "gemini-2.5-flash";

interface GeminiPart {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

interface GeminiResponse {
  candidates?: {
    content?: { parts?: GeminiPart[]; role?: string };
    finishReason?: string;
  }[];
  promptFeedback?: unknown;
  error?: { message?: string; status?: string };
}

function parseInlineDataUrl(dataUrl: string): {
  mimeType: string;
  base64: string;
} {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) {
    throw new Error(
      "La imagen debe llegar como dataURL base64 (data:image/...;base64,...)"
    );
  }
  return { mimeType: m[1], base64: m[2] };
}

export async function extractWithGemini(
  opts: VisionExtractOptions
): Promise<VisionExtractResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new VisionProviderError({
      provider: "gemini",
      kind: "config",
      message: "GEMINI_API_KEY no configurada",
    });
  }

  const baseUrl = process.env.GEMINI_BASE_URL ?? DEFAULT_BASE_URL;
  const model = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;

  // Gemini detecta objetos nativamente en formato [y_min, x_min, y_max, x_max].
  // Aprovechamos eso pidiéndoselo así y haciendo swap al recibirlo.
  // Puedes forzar xyxy (formato Qwen) con GEMINI_BBOX_NATIVE_ORDER=false.
  const useNativeBboxOrder =
    parseOptionalBoolean(process.env.GEMINI_BBOX_NATIVE_ORDER) ?? true;
  const bboxOrder: "yxyx" | "xyxy" = useNativeBboxOrder ? "yxyx" : "xyxy";

  const promptOpts = {
    withBboxes: opts.withBboxes,
    bboxOrder,
    includeTemplate: false,
  };

  const baseUserPrompt = opts.previousExtraction
    ? buildMergeUserPrompt(opts.previousExtraction, promptOpts)
    : buildInitialUserPrompt(promptOpts);

  const multiPageNote =
    opts.imageDataUrls.length > 1
      ? `\n\nNota: Se adjuntan ${opts.imageDataUrls.length} imágenes que corresponden a páginas del MISMO documento. Combina la información de todas ellas en UN solo JSON. Los arrays (detalles_cheques, n_c_rechazo_*, n_c_por_negocios, detalle_transferencias, detalle_efectivo.billetes) deben incluir filas de cualquier página, sin duplicar entradas.`
      : "";
  const userPrompt = baseUserPrompt + multiPageNote;

  const imageParts: GeminiPart[] = opts.imageDataUrls.map((dataUrl) => {
    const { mimeType, base64 } = parseInlineDataUrl(dataUrl);
    return { inline_data: { mime_type: mimeType, data: base64 } };
  });

  const responseSchema = buildGeminiExtractionSchema(opts.withBboxes);

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [
      {
        role: "user",
        parts: [...imageParts, { text: userPrompt }],
      },
    ],
    generation_config: {
      temperature: 0.1,
      response_mime_type: "application/json",
      response_schema: responseSchema,
    },
  };

  const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent`;
  console.log(
    `[gemini] POST ${url} (model=${model}, withBboxes=${opts.withBboxes}, bboxOrder=${bboxOrder}, images=${opts.imageDataUrls.length})`
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    const detail =
      cause && typeof cause === "object" && cause !== null
        ? JSON.stringify(cause, Object.getOwnPropertyNames(cause)).slice(0, 300)
        : String(cause ?? error);
    console.error("[gemini] fetch error", { detail });
    throw new VisionProviderError({
      provider: "gemini",
      kind: "network",
      cause: error,
      message: `No se pudo conectar a la API de Gemini. Detalle: ${detail}`,
    });
  }

  if (!response.ok) {
    const text = await response.text();
    console.error("[gemini] HTTP error", response.status, text.slice(0, 500));
    // Algunos errores de Gemini vienen con un JSON `{ error: { status, message } }`
    // dentro del body aun siendo HTTP no-OK. Intentamos extraer el `status`
    // textual para clasificarlo (UNAVAILABLE, RESOURCE_EXHAUSTED, etc).
    let code: string | undefined;
    try {
      const parsed = JSON.parse(text) as {
        error?: { status?: string; code?: number };
      };
      if (typeof parsed.error?.status === "string") code = parsed.error.status;
    } catch {
      // Body no era JSON; no pasa nada.
    }
    throw new VisionProviderError({
      provider: "gemini",
      kind: kindFromStatus(response.status),
      status: response.status,
      code,
      retryAfterMs: parseRetryAfterMs(response.headers.get("retry-after")),
      message: `Gemini API ${response.status}${code ? ` (${code})` : ""}: ${text.slice(0, 300)}`,
    });
  }

  const data = (await response.json()) as GeminiResponse;

  if (data.error) {
    throw new VisionProviderError({
      provider: "gemini",
      kind: "http",
      code: data.error.status,
      message:
        `Gemini API error: ${data.error.status ?? ""} ${data.error.message ?? ""}`.trim(),
    });
  }

  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const content = parts
    .map((p) => (typeof p.text === "string" ? p.text : ""))
    .join("");

  if (!content) {
    console.error(
      "[gemini] respuesta sin texto",
      JSON.stringify(data).slice(0, 500)
    );
    throw new VisionProviderError({
      provider: "gemini",
      kind: "empty",
      message: "Gemini devolvió una respuesta vacía",
    });
  }

  let extraction = parseExtractionFromText(content);
  if (bboxOrder === "yxyx" && opts.withBboxes) {
    extraction = swapBboxAxes(extraction);
  }

  return {
    extraction,
    rawResponse: JSON.stringify(data, null, 2),
    model,
    provider: "gemini",
  };
}
