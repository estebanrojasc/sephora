"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ClipboardList,
  Database,
  BookOpen,
  LogOut,
  Menu,
  PanelLeft,
  PanelLeftClose,
  type LucideIcon,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/common/ThemeToggle";
import { AdminSystemStatus } from "@/components/admin/AdminSystemStatus";
import { APP_NAME, COPY } from "@/lib/constants";
import { useSessionStore } from "@/features/auth/session-store";
import { cn } from "@/lib/utils";

const navItems: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Cola de trabajo", icon: ClipboardList },
  { href: "/admin/bitacora", label: "Bitácora", icon: BookOpen },
  { href: "/admin/catalogs", label: "Catálogos", icon: Database },
];

interface NavContentProps {
  pathname: string;
  showLabels: boolean;
}

function NavContent({ pathname, showLabels }: NavContentProps) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active =
          pathname === item.href ||
          (item.href !== "/admin" && pathname.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" />
            {showLabels && item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { admin, hydrateAdminFromServer, clearSession } = useSessionStore();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void hydrateAdminFromServer().then(() => setHydrated(true));
  }, [hydrateAdminFromServer]);

  useEffect(() => {
    if (hydrated && !admin) router.replace("/login");
  }, [hydrated, admin, router]);

  if (!hydrated || !admin) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-muted-foreground">
        Verificando sesión…
      </div>
    );
  }

  return (
    <div className="flex min-h-full">
      <aside
        className={cn(
          "hidden border-r bg-sidebar transition-all lg:flex lg:flex-col",
          sidebarOpen ? "w-56" : "w-16"
        )}
      >
        <div className="flex h-14 items-center justify-between border-b px-3">
          {sidebarOpen && (
            <span className="truncate bg-gradient-to-r from-indigo-600 to-violet-500 bg-clip-text font-semibold text-transparent">
              {APP_NAME}
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setSidebarOpen((o) => !o)}
            className="shrink-0"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="size-4" />
            ) : (
              <PanelLeft className="size-4" />
            )}
          </Button>
        </div>
        <NavContent pathname={pathname} showLabels={sidebarOpen} />
        <div className="mt-auto border-t p-3">
          {sidebarOpen && (
            <div className="mb-2 truncate px-1 text-xs text-muted-foreground">
              {admin.name}
            </div>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start gap-2"
            onClick={() => {
              clearSession();
              router.replace("/login");
            }}
          >
            <LogOut className="size-4" />
            {sidebarOpen && "Salir"}
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2 lg:hidden">
            <Sheet>
              <SheetTrigger
                className={cn(
                  buttonVariants({ variant: "outline", size: "icon-sm" })
                )}
              >
                <Menu className="size-4" />
              </SheetTrigger>
              <SheetContent side="left" className="w-64 p-0">
                <div className="border-b p-4 font-semibold">{APP_NAME}</div>
                <NavContent pathname={pathname} showLabels />
              </SheetContent>
            </Sheet>
            <span className="font-medium">{COPY.admin.title}</span>
          </div>
          <p className="hidden font-medium lg:block">{COPY.admin.title}</p>
          <ThemeToggle />
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <AdminSystemStatus />
          {children}
        </main>
      </div>
    </div>
  );
}
