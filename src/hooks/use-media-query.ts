"use client";

import { useSyncExternalStore } from "react";

/**
 * Suscripción a una media query usando useSyncExternalStore. Evita el patrón
 * "setState dentro de useEffect" y es seguro con SSR (devuelve el snapshot
 * del servidor en la hidratación).
 */
function subscribe(query: string) {
  return (callback: () => void) => {
    if (typeof window === "undefined") return () => {};
    const mq = window.matchMedia(query);
    mq.addEventListener("change", callback);
    return () => mq.removeEventListener("change", callback);
  };
}

function getSnapshot(query: string) {
  return () =>
    typeof window === "undefined" ? false : window.matchMedia(query).matches;
}

function getServerSnapshot() {
  return false;
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    subscribe(query),
    getSnapshot(query),
    getServerSnapshot
  );
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 768px)");
}
