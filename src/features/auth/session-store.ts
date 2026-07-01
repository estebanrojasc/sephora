"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getOrCreateDeviceId } from "./device-id";

export type UserRole = "driver" | "admin" | null;

export interface AdminInfo {
  id: string;
  email: string;
  name: string;
}

interface SessionState {
  role: UserRole;
  driverId: string | null;
  driverName: string | null;
  deviceId: string | null;
  /** Datos del admin si está logueado. Se hidrata desde /api/auth/me. */
  admin: AdminInfo | null;
  totalAdmins: number;

  setDriver: (name?: string) => void;
  setAdminFromServer: (admin: AdminInfo) => void;
  clearSession: () => void;
  hydrateDeviceId: () => void;
  hydrateAdminFromServer: () => Promise<void>;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      role: null,
      driverId: null,
      driverName: null,
      deviceId: null,
      admin: null,
      totalAdmins: 0,

      setDriver: (name) => {
        const deviceId = getOrCreateDeviceId();
        set({
          role: "driver",
          driverId: crypto.randomUUID(),
          driverName: name ?? "Conductor Demo",
          deviceId,
          admin: null,
        });
        // Evita que una cookie admin previa redirija al panel en el mismo navegador.
        void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      },

      setAdminFromServer: (admin) => {
        set({
          role: "admin",
          admin,
          driverId: null,
          driverName: null,
          deviceId: null,
        });
      },

      clearSession: () => {
        set({
          role: null,
          driverId: null,
          driverName: null,
          deviceId: null,
          admin: null,
        });
        void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
      },

      hydrateDeviceId: () => {
        const deviceId = getOrCreateDeviceId();
        set({ deviceId });
      },

      hydrateAdminFromServer: async () => {
        try {
          const res = await fetch("/api/auth/me", { cache: "no-store" });
          if (!res.ok) return;
          const data = (await res.json()) as {
            user: AdminInfo | null;
            totalAdmins: number;
          };
          set((state) => {
            if (state.role === "driver") {
              return { totalAdmins: data.totalAdmins };
            }
            return {
              totalAdmins: data.totalAdmins,
              admin: data.user,
              role: data.user
                ? "admin"
                : state.role === "admin"
                  ? null
                  : state.role,
            };
          });
        } catch {
          // ignore
        }
      },
    }),
    {
      name: "qwen-visor-session",
      partialize: (state) => ({
        role: state.role,
        driverId: state.driverId,
        driverName: state.driverName,
        deviceId: state.deviceId,
      }),
    }
  )
);
