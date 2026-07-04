"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Smartphone, LogIn, Sparkles, ChevronRight, Shield } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { APP_NAME, COPY } from "@/lib/constants";
import { useSessionHydrated } from "@/features/auth/use-session-hydrated";
import { useSessionStore } from "@/features/auth/session-store";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.25, 0.4, 0.25, 1] as const } },
};

function FloatingBlob({ className }: { className: string }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl ${className}`}
      animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
      transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export default function HomePage() {
  const router = useRouter();
  const hydrated = useSessionHydrated();
  const { role, admin, setDriver, hydrateAdminFromServer } = useSessionStore();
  const [adminChecked, setAdminChecked] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    void hydrateAdminFromServer().finally(() => setAdminChecked(true));
  }, [hydrateAdminFromServer]);

  useEffect(() => {
    if (!hydrated || !adminChecked) return;
    if (role === "driver") { router.replace("/driver"); return; }
    if (admin) router.replace("/admin");
  }, [hydrated, adminChecked, role, admin, router]);

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Animated background blobs */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <FloatingBlob className="-top-32 left-1/4 size-[500px] bg-indigo-200/40 dark:bg-indigo-800/15" />
        <FloatingBlob className="top-1/2 -right-32 size-[400px] bg-violet-200/40 dark:bg-violet-800/15" />
        <FloatingBlob className="-bottom-40 left-1/3 size-[450px] bg-fuchsia-200/30 dark:bg-fuchsia-800/10" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background" />
      </div>

      <AnimatePresence mode="wait">
        {!mounted ? (
          <div key="skeleton" className="flex flex-col items-center gap-6">
            <div className="size-16 animate-shimmer rounded-2xl bg-muted" />
            <div className="h-10 w-48 animate-shimmer rounded-lg bg-muted" />
            <div className="h-5 w-64 animate-shimmer rounded-md bg-muted" />
            <div className="grid w-full max-w-sm gap-4">
              <div className="h-48 animate-shimmer rounded-2xl bg-muted" />
              <div className="h-48 animate-shimmer rounded-2xl bg-muted" />
            </div>
          </div>
        ) : (
          <motion.div
            key="content"
            variants={container}
            initial="hidden"
            animate="show"
            className="flex w-full max-w-md flex-col items-center gap-8"
          >
            {/* Hero */}
            <motion.div variants={item} className="flex flex-col items-center gap-4 text-center">
              <motion.div
                whileHover={{ scale: 1.05, rotate: 5 }}
                className="flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-xl shadow-indigo-500/30"
              >
                <Sparkles className="size-9 text-white" />
              </motion.div>
              <div>
                <h1 className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent dark:from-indigo-400 dark:to-violet-400 text-4xl font-extrabold tracking-tight sm:text-5xl">
                  {APP_NAME}
                </h1>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  Digitalización inteligente de hojas de ruta manuscritas.
                  Captura, extrae y valida con IA en segundos.
                </p>
              </div>
            </motion.div>

            {/* Role cards */}
            <motion.div variants={item} className="grid w-full gap-4">
              {/* Driver card */}
              <Card className="group glass hover-lift tap-active cursor-pointer overflow-hidden border-2 border-transparent transition-all duration-300 hover:border-blue-400/30">
                <CardHeader className="pb-3">
                  <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 shadow-md shadow-blue-500/15 transition-transform duration-300 group-hover:scale-110 dark:bg-blue-950 dark:text-blue-300">
                    <Smartphone className="size-6" />
                  </div>
                  <CardTitle>{COPY.role.driver}</CardTitle>
                  <CardDescription>{COPY.role.driverDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button
                    className="w-full gap-2 bg-blue-600 shadow-lg shadow-blue-500/25 hover:bg-blue-500 hover:shadow-xl hover:shadow-blue-500/30"
                    size="lg"
                    onClick={() => { setDriver(); router.push("/driver"); }}
                  >
                    Entrar como conductor
                    <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </CardContent>
              </Card>

              {/* Admin card */}
              <Card className="group glass hover-lift tap-active cursor-pointer overflow-hidden border-2 border-transparent transition-all duration-300 hover:border-indigo-400/30">
                <CardHeader className="pb-3">
                  <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 shadow-md shadow-indigo-500/15 transition-transform duration-300 group-hover:scale-110 dark:bg-indigo-950 dark:text-indigo-300">
                    <Shield className="size-6" />
                  </div>
                  <CardTitle>{COPY.role.admin}</CardTitle>
                  <CardDescription>{COPY.role.adminDesc}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Link href="/login" className="block w-full">
                    <Button
                      size="lg"
                      variant="outline"
                      className="w-full gap-2 border-2 border-indigo-200 shadow-sm hover:bg-indigo-50 hover:shadow-md dark:border-indigo-800 dark:hover:bg-indigo-950/30"
                    >
                      <LogIn className="size-4" />
                      Entrar como administrador
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </motion.div>

            {/* Footer */}
            <motion.p
              variants={item}
              className="text-center text-xs text-muted-foreground/50"
            >
              v0.2 · Procesamiento Qwen-VL · Diseño 2026
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
