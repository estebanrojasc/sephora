import type { Bbox, ExtractedField } from "./types";

export function applyManualBboxCorrection(
  field: ExtractedField,
  correctedBbox: Bbox
): ExtractedField {
  const originalBbox = field.bboxCorrection?.originalBbox ?? field.bbox;
  return {
    ...field,
    bbox: correctedBbox,
    bboxSource: "manual",
    bboxCorrection: {
      originalBbox,
      correctedBbox,
      delta: {
        x1: correctedBbox[0] - originalBbox[0],
        y1: correctedBbox[1] - originalBbox[1],
        x2: correctedBbox[2] - originalBbox[2],
        y2: correctedBbox[3] - originalBbox[3],
        centerX:
          (correctedBbox[0] + correctedBbox[2]) / 2 -
          (originalBbox[0] + originalBbox[2]) / 2,
        centerY:
          (correctedBbox[1] + correctedBbox[3]) / 2 -
          (originalBbox[1] + originalBbox[3]) / 2,
      },
      correctedAt: new Date().toISOString(),
    },
  };
}
