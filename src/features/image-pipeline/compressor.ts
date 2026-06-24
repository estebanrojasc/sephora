import Compressor from "compressorjs";
import { PIPELINE_ORIGINAL_JPEG_QUALITY } from "@/lib/constants";

export function compressImage(
  blob: Blob,
  quality: number = PIPELINE_ORIGINAL_JPEG_QUALITY
): Promise<Blob> {
  const file = new File([blob], "optimized.jpg", {
    type: blob.type || "image/png",
  });

  return new Promise((resolve, reject) => {
    new Compressor(file, {
      quality,
      mimeType: "image/jpeg",
      convertSize: 0,
      success(result) {
        resolve(result as Blob);
      },
      error(err) {
        reject(err);
      },
    });
  });
}
