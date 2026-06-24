import type { ExtractedField, Extraction } from "@/features/records/types";
import type { ScalarValue } from "./build-rendicion";
import {
  SCALAR_PLACEHOLDER_ALIASES,
  TEXT_SCALAR_LEAF_KEYS,
} from "./placeholder-registry";

function isExtractedField(value: unknown): value is ExtractedField {
  return (
    !!value &&
    typeof value === "object" &&
    "valor" in value &&
    "bbox" in value
  );
}

/** Genera scalars para cada {{extraction....valor}} recorriendo la extracción. */
export function buildExtractionScalars(
  extraction: Extraction
): Record<string, ScalarValue> {
  const scalars: Record<string, ScalarValue> = {};

  function walk(node: unknown, path: string[]): void {
    if (isExtractedField(node)) {
      const leaf = path[path.length - 1] ?? "";
      const key = `{{extraction.${path.join(".")}.valor}}`;
      scalars[key] = {
        value: node.valor ?? "",
        numeric: !TEXT_SCALAR_LEAF_KEYS.has(leaf),
      };
      return;
    }
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith("_")) continue;
      walk(value, [...path, key]);
    }
  }

  walk(extraction, []);

  for (const [alias, canonical] of Object.entries(SCALAR_PLACEHOLDER_ALIASES)) {
    const target = scalars[canonical];
    if (target) scalars[alias] = { ...target };
  }

  return scalars;
}
