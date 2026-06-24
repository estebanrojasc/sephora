import { scanDocument } from "scanic";

export interface Point {
  x: number;
  y: number;
}

export interface CornerPoints {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
}

/** Rectángulo en coordenadas de píxeles de la imagen original. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Detecta el documento en la imagen y devuelve un rectángulo de recorte sugerido
 * con un pequeño margen. Si la detección es pobre o falla, devuelve null.
 */
export async function suggestCropRect(file: File): Promise<{
  rect: CropRect | null;
  imageWidth: number;
  imageHeight: number;
}> {
  const img = await loadImageFromFile(file);
  const imageWidth = img.naturalWidth;
  const imageHeight = img.naturalHeight;

  try {
    const detection = await scanDocument(img, {
      mode: "detect",
      maxProcessingDimension: 1200,
    });

    if (!detection.success) {
      return { rect: null, imageWidth, imageHeight };
    }

    const corners = detection.corners as CornerPoints;
    const xs = [
      corners.topLeft.x,
      corners.topRight.x,
      corners.bottomRight.x,
      corners.bottomLeft.x,
    ];
    const ys = [
      corners.topLeft.y,
      corners.topRight.y,
      corners.bottomRight.y,
      corners.bottomLeft.y,
    ];

    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    const padX = (maxX - minX) * 0.03;
    const padY = (maxY - minY) * 0.03;

    const x = Math.max(0, minX - padX);
    const y = Math.max(0, minY - padY);
    const width = Math.min(imageWidth - x, maxX - minX + padX * 2);
    const height = Math.min(imageHeight - y, maxY - minY + padY * 2);

    const coverage = (width * height) / (imageWidth * imageHeight);
    if (coverage < 0.15 || coverage > 0.99) {
      return { rect: null, imageWidth, imageHeight };
    }

    return { rect: { x, y, width, height }, imageWidth, imageHeight };
  } catch (error) {
    console.warn("Scanic falló durante detección:", error);
    return { rect: null, imageWidth, imageHeight };
  }
}

/** Aplica un recorte rectangular a la imagen y devuelve un Blob PNG. */
export async function applyCrop(file: File, rect: CropRect): Promise<Blob> {
  const img = await loadImageFromFile(file);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(rect.width);
  canvas.height = Math.round(rect.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo crear contexto canvas");

  ctx.drawImage(
    img,
    rect.x,
    rect.y,
    rect.width,
    rect.height,
    0,
    0,
    canvas.width,
    canvas.height
  );

  return canvasToBlob(canvas);
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("No se pudo convertir canvas")),
      "image/png"
    );
  });
}
