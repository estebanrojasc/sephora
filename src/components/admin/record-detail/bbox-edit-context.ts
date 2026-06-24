"use client";

import { createContext, useContext } from "react";
import type { Bbox } from "@/features/records/types";

export interface BboxEditContextValue {
  /** Identificador del campo cuyo bbox se está editando, o null. */
  activeId: string | null;
  /** El campo solicita iniciar el modo dibujo entregando su setter. */
  requestEdit: (id: string, setter: (bbox: Bbox) => void) => void;
}

export const BboxEditContext = createContext<BboxEditContextValue | null>(null);

export function useBboxEdit() {
  return useContext(BboxEditContext);
}
