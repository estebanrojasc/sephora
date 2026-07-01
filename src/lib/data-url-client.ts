export function dataUrlContentType(dataUrl: string): string {
  const match = dataUrl.match(/^data:([^;]+);/);
  return match?.[1] ?? "image/jpeg";
}

export function dataUrlToBlob(dataUrl: string): { blob: Blob; contentType: string } {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]*)$/);
  if (!match) {
    throw new Error("Data URL inválida");
  }
  const contentType = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return { blob: new Blob([bytes], { type: contentType }), contentType };
}

export async function putBlobToSignedUrl(
  uploadUrl: string,
  blob: Blob,
  contentType: string
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: blob,
    headers: { "Content-Type": contentType },
  });
  if (!res.ok) {
    throw new Error(`Error al subir imagen al bucket (${res.status})`);
  }
}
