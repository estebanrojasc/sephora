import "server-only";
import {
  buildInitialUserPrompt,
  buildMergeUserPrompt,
  SYSTEM_PROMPT,
} from "./prompts";
import { parseExtractionFromText } from "./normalize";
import {
  parseOptionalBoolean,
  parseOptionalPositiveInt,
} from "./config";
import {
  VisionProviderError,
  kindFromStatus,
  parseRetryAfterMs,
} from "./errors";
import type { VisionExtractOptions, VisionExtractResult } from "./types";

const DEFAULT_BASE_URL =
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL = "qwen3-vl-flash";

export async function extractWithQwen(
  opts: VisionExtractOptions
): Promise<VisionExtractResult> {
  const apiKey = process.env.QWEN_API_KEY;
  if (!apiKey) {
    throw new VisionProviderError({
      provider: "qwen",
      kind: "config",
      message: "QWEN_API_KEY no configurada",
    });
  }

  const baseUrl = process.env.QWEN_BASE_URL ?? DEFAULT_BASE_URL;
  const model = process.env.QWEN_MODEL ?? DEFAULT_MODEL;
  const maxPixels = parseOptionalPositiveInt(process.env.QWEN_MAX_PIXELS);
  const highResolutionImages = parseOptionalBoolean(
    process.env.QWEN_VL_HIGH_RESOLUTION_IMAGES
  );

  const userPrompt = opts.previousExtraction
    ? buildMergeUserPrompt(opts.previousExtraction, {
        withBboxes: opts.withBboxes,
      })
    : buildInitialUserPrompt({ withBboxes: opts.withBboxes });

  const imageContents = opts.imageDataUrls.map((url) => {
    const c: {
      type: "image_url";
      image_url: { url: string };
      max_pixels?: number;
    } = { type: "image_url", image_url: { url } };
    if (maxPixels) c.max_pixels = maxPixels;
    return c;
  });

  const multiPageNote =
    opts.imageDataUrls.length > 1
      ? `\n\nNota: Se adjuntan ${opts.imageDataUrls.length} imágenes que corresponden a páginas del MISMO documento. Combina la información de todas ellas en UN solo JSON. Los arrays (detalles_cheques, n_c_rechazo_*, n_c_por_negocios, detalle_transferencias, detalle_credito_vendedor, detalle_efectivo.billetes) deben incluir filas de cualquier página, sin duplicar entradas.`
      : "";

  const body: {
    model: string;
    temperature: number;
    response_format: { type: "json_object" };
    messages: unknown[];
    vl_high_resolution_images?: boolean;
  } = {
    model,
    temperature: 0.1,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: [
          ...imageContents,
          { type: "text", text: userPrompt + multiPageNote },
        ],
      },
    ],
  };

  if (highResolutionImages !== undefined) {
    body.vl_high_resolution_images = highResolutionImages;
  }

  const url = `${baseUrl}/chat/completions`;
  console.log(
    `[qwen] POST ${url} (model=${model}, withBboxes=${opts.withBboxes}, images=${opts.imageDataUrls.length})`
  );

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const cause = (error as Error & { cause?: unknown }).cause;
    const detail =
      cause && typeof cause === "object" && cause !== null
        ? JSON.stringify(cause, Object.getOwnPropertyNames(cause)).slice(0, 300)
        : String(cause ?? error);
    console.error("[qwen] fetch error", { url, detail });
    throw new VisionProviderError({
      provider: "qwen",
      kind: "network",
      cause: error,
      message: `No se pudo conectar a la API de Qwen (${url}). Detalle: ${detail}`,
    });
  }

  if (!response.ok) {
    const text = await response.text();
    console.error("[qwen] HTTP error", response.status, text.slice(0, 500));
    throw new VisionProviderError({
      provider: "qwen",
      kind: kindFromStatus(response.status),
      status: response.status,
      retryAfterMs: parseRetryAfterMs(response.headers.get("retry-after")),
      message: `Qwen API ${response.status}: ${text.slice(0, 300)}`,
    });
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content ?? "";
  return {
    extraction: parseExtractionFromText(content),
    rawResponse: JSON.stringify(data, null, 2),
    model,
    provider: "qwen",
  };
}
