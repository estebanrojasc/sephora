"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Inbox, Camera, LogOut, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { useSessionStore } from "@/features/auth/session-store";
import { useSessionHydrated } from "@/features/auth/use-session-hydrated";
import { APP_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/driver", label: "Mis envíos", icon: Inbox, exact: true },
  { href: "/driver/capture", label: "Nuevo", icon: Camera },
] as const;

export default function DriverLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useSessionHydrated();
  const { role, clearSession, hydrateDeviceId } = useSessionStore();

  useEffect(() => {
    if (!hydrated) return;
    if (role !== "driver") { router.replace("/"); return; }
    hydrateDeviceId();
  }, [hydrated, role, router, hydrateDeviceId]);

  if (!hydrated || role !== "driver") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="size-8 skeleton rounded-xl" />
          <div className="h-5 w-32 skeleton rounded-md" />
        </div>
      </div>
    );
  }

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 glass-strong border-b">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/driver" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 shadow-md">
              <Sparkles className="size-4 text-white" />
            </div>
            <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400 text-lg font-bold">{APP_NAME}</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="icon-sm" onClick={() => { clearSession(); router.push("/"); }} title="Salir">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <nav className="fixed bottom-0 inset-x-0 z-40 glass-strong border-t pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-around px-2 py-1.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href, "exact" in item ? item.exact : false);
            return (
              <Link key={item.href} href={item.href}
                className={cn("flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-xs font-medium transition-all duration-200",
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
                <item.icon className={cn("size-5 transition-all duration-200", active && "drop-shadow-[0_0_6px_var(--primary)]")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
