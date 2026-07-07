"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, BookOpen, Database, Menu, ChevronLeft, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { BrandLogo } from "@/components/common/BrandLogo";
import { AdminSystemStatus } from "@/components/admin/AdminSystemStatus";
import { useSessionStore } from "@/features/auth/session-store";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/admin", label: "Cola de revisión", icon: ClipboardList, exact: true },
  { href: "/admin/bitacora", label: "Bitácora diaria", icon: BookOpen },
  { href: "/admin/catalogs", label: "Catálogos", icon: Database },
] as const;

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const clearSession = useSessionStore((s) => s.clearSession);
  const admin = useSessionStore((s) => s.admin);
  const hydrateAdminFromServer = useSessionStore((s) => s.hydrateAdminFromServer);
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => { void hydrateAdminFromServer().finally(() => setHydrated(true)); }, [hydrateAdminFromServer]);

  // Redirect effect must be before any conditional returns (Rules of Hooks)
  useEffect(() => {
    if (!hydrated) return;
    if (!admin) router.replace("/login");
  }, [hydrated, admin, router]);

  const handleLogout = useCallback(() => { clearSession(); router.push("/login"); }, [clearSession, router]);

  if (!hydrated) {
    return (
      <div className="flex h-dvh items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="size-8 animate-shimmer rounded-xl bg-muted" />
          <div className="h-5 w-32 animate-shimmer rounded-md bg-muted" />
        </div>
      </div>
    );
  }

  const isActive = (href: string, exact?: boolean) => exact ? pathname === href : pathname.startsWith(href);

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-3">
      <BrandLogo href="/admin" showName={!collapsed} size={collapsed ? "sm" : "md"} className={cn("mb-4 px-2 py-1.5", collapsed && "justify-center")} />
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href, "exact" in item ? item.exact : false);
        return (
          <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
            className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
              collapsed && "justify-center px-2",
              active ? "bg-primary/10 text-primary shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
            title={collapsed ? item.label : undefined}>
            <item.icon className={cn("size-5 shrink-0", active && "text-primary")} />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
      <div className="mt-auto flex flex-col gap-1 border-t pt-3">
        <ThemeToggle />
        <button onClick={handleLogout}
          className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive",
            collapsed && "justify-center px-2")}
          title={collapsed ? "Cerrar sesión" : undefined}>
          <LogOut className="size-5 shrink-0" />{!collapsed && <span>Cerrar sesión</span>}
        </button>
      </div>
    </nav>
  );

  return (
    <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
      <div className="flex h-dvh overflow-hidden bg-background">
        {/* Desktop sidebar */}
        <aside className={cn("relative hidden lg:flex flex-col border-r bg-sidebar transition-all duration-300", collapsed ? "w-[68px]" : "w-[240px]")}>
          <button onClick={() => setCollapsed(!collapsed)}
            className="absolute -right-3 top-6 z-10 flex size-6 items-center justify-center rounded-full border bg-card shadow-sm hover:bg-muted transition-colors">
            <ChevronLeft className={cn("size-3.5 text-muted-foreground transition-transform duration-300", collapsed && "rotate-180")} />
          </button>
          {sidebar}
        </aside>

        {/* Mobile drawer content */}
        <SheetContent side="left" className="w-[260px] p-0">
          {sidebar}
        </SheetContent>

        {/* Main content */}
        <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
          {/* Mobile top bar */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b px-4 lg:hidden">
            <SheetTrigger render={<Button variant="ghost" size="icon-sm"><Menu className="size-5" /></Button>} />
            <BrandLogo href="/admin" size="sm" className="min-w-0 flex-1" />
            <div className="ml-auto"><ThemeToggle /></div>
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-auto p-4 md:p-6 lg:p-8">
            <AdminSystemStatus />
            {children}
          </main>
        </div>
      </div>
    </Sheet>
  );
}