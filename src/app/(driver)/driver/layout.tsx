"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { APP_NAME } from "@/lib/constants";
import { useSessionStore } from "@/features/auth/session-store";

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { role, clearSession, hydrateDeviceId } = useSessionStore();

  useEffect(() => {
    if (role !== "driver") {
      router.replace("/");
      return;
    }
    hydrateDeviceId();
  }, [role, router, hydrateDeviceId]);

  if (role !== "driver") return null;

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-indigo-50/40 via-background to-background dark:from-indigo-950/20">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-background/85 px-4 py-3 backdrop-blur">
        <Link
          href="/driver"
          className="bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text font-semibold text-transparent"
        >
          {APP_NAME}
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              clearSession();
              router.replace("/");
            }}
            aria-label="Salir"
          >
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1 pb-28">{children}</main>
    </div>
  );
}
