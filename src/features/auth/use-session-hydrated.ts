"use client";

import { useEffect, useState } from "react";
import { useSessionStore } from "./session-store";

/** Espera a que Zustand persist restaure role/deviceId desde localStorage. */
export function useSessionHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() =>
    useSessionStore.persist.hasHydrated()
  );

  useEffect(() => {
    if (useSessionStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return useSessionStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
  }, []);

  return hydrated;
}
