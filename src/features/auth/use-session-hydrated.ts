"use client";

import { useEffect, useState } from "react";
import { useSessionStore } from "./session-store";

/** Espera a que Zustand persist restaure role/deviceId desde localStorage. */
export function useSessionHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const persist = useSessionStore.persist;
    if (!persist?.hasHydrated || !persist.onFinishHydration) {
      setHydrated(true);
      return;
    }
    if (persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    return persist.onFinishHydration(() => {
      setHydrated(true);
    });
  }, []);

  return hydrated;
}
