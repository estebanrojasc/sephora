/**
 * Realce de imagen orientado a documentos manuscritos.
 *
 * Aplica un "auto-levels" (histogram stretch percentil 1–99 sobre luminosidad)
 * que iguala iluminación dispareja y resalta trazos. Mantiene el color para no
 * perder información (correcciones en rojo, sellos, etc.).
 *
 * Se ejecuta en canvas del navegador. El blob de salida es PNG para no añadir
 * ruido JPEG antes de la compresión final.
 */
export async function enhanceForOcr(blob: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    bitmap.close();
    return blob;
  }
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  const total = data.length / 4;

  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const y = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
    histogram[y]++;
  }

  const lowTarget = total * 0.01;
  const highTarget = total * 0.01;
  let lo = 0;
  let hi = 255;
  let cum = 0;
  for (let i = 0; i < 256; i++) {
    cum += histogram[i];
    if (cum >= lowTarget) {
      lo = i;
      break;
    }
  }
  cum = 0;
  for (let i = 255; i >= 0; i--) {
    cum += histogram[i];
    if (cum >= highTarget) {
      hi = i;
      break;
    }
  }
  if (hi - lo < 32) {
    return blob;
  }
  const scale = 255 / (hi - lo);

  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    lut[i] = Math.max(0, Math.min(255, Math.round((i - lo) * scale)));
  }

  for (let i = 0; i < data.length; i += 4) {
    data[i] = lut[data[i]];
    data[i + 1] = lut[data[i + 1]];
    data[i + 2] = lut[data[i + 2]];
  }

  ctx.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("enhance falló"))),
      "image/png"
    );
  });
}
