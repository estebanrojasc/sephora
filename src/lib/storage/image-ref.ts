/** Referencia almacenada en Mongo: data URL legacy, clave GCS o URL HTTP. */

export function isDataUrl(ref: string): boolean {
  return ref.startsWith("data:");
}

export function isHttpUrl(ref: string): boolean {
  return ref.startsWith("http://") || ref.startsWith("https://");
}

/** Clave de objeto en el bucket, p. ej. records/{recordId}/{imageId}/original.jpg */
export function isGcsObjectKey(ref: string): boolean {
  return ref.startsWith("records/") && !isHttpUrl(ref);
}

export function parseDataUrl(dataUrl: string): {
  mimeType: string;
  buffer: Buffer;
} {
  const m = dataUrl.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!m) {
    throw new Error("Data URL inválida (se esperaba data:image/...;base64,...)");
  }
  return { mimeType: m[1], buffer: Buffer.from(m[2], "base64") };
}

export function mimeToExt(mimeType: string): string {
  const m = mimeType.toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("webp")) return "webp";
  if (m.includes("png")) return "png";
  return "jpg";
}

export function recordImageObjectKey(
  recordId: string,
  imageId: string,
  variant: "original" | "processed",
  ext: string
): string {
  return `records/${recordId}/${imageId}/${variant}.${ext}`;
}
