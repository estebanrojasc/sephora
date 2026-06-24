import PicaConstructor from "pica";
import { PIPELINE_ORIGINAL_MAX_DIMENSION } from "@/lib/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Pica = PicaConstructor as any;
const pica = new Pica({ features: ["js", "wasm", "cib"] }) as {
  resize: (
    from: HTMLCanvasElement,
    to: HTMLCanvasElement,
    opts?: object
  ) => Promise<void>;
};

export async function resizeImage(
  blob: Blob,
  maxDimension: number = PIPELINE_ORIGINAL_MAX_DIMENSION
): Promise<Blob> {
  const bitmap = await createImageBitmap(blob);
  const { width, height } = bitmap;
  const scale =
    Math.max(width, height) > maxDimension
      ? maxDimension / Math.max(width, height)
      : 1;

  const targetW = Math.round(width * scale);
  const targetH = Math.round(height * scale);

  if (scale === 1) {
    bitmap.close();
    return blob;
  }

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const ctx = sourceCanvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const destCanvas = document.createElement("canvas");
  destCanvas.width = targetW;
  destCanvas.height = targetH;

  await pica.resize(sourceCanvas, destCanvas, {
    unsharpAmount: 60,
    unsharpRadius: 0.5,
    unsharpThreshold: 2,
  });

  return new Promise((resolve, reject) => {
    destCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Resize falló"))),
      "image/png"
    );
  });
}
