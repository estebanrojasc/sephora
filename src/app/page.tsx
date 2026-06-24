"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClipboardList, Smartphone, LogIn } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { APP_NAME, COPY } from "@/lib/constants";
import { useSessionStore } from "@/features/auth/session-store";

export default function HomePage() {
  const router = useRouter();
  const { role, admin, setDriver, hydrateAdminFromServer } = useSessionStore();

  useEffect(() => {
    void hydrateAdminFromServer();
  }, [hydrateAdminFromServer]);

  useEffect(() => {
    if (role === "driver") router.replace("/driver");
  }, [role, router]);

  useEffect(() => {
    if (admin) router.replace("/admin");
  }, [admin, router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-8 p-6">
      <div className="space-y-2 text-center">
        <h1 className="bg-gradient-to-r from-indigo-600 via-violet-500 to-fuchsia-500 bg-clip-text text-4xl font-bold tracking-tight text-transparent">
          {APP_NAME}
        </h1>
        <p className="text-muted-foreground">
          Captura, revisión y digitalización de rutas manuscritas con IA
        </p>
      </div>

      <div className="grid gap-4">
        <Card className="border-blue-200/60 transition-all hover:border-blue-300 hover:shadow-md dark:border-blue-900/50">
          <CardHeader>
            <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300">
              <Smartphone className="size-6" />
            </div>
            <CardTitle>{COPY.role.driver}</CardTitle>
            <CardDescription>{COPY.role.driverDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              className="w-full bg-blue-600 hover:bg-blue-500"
              size="lg"
              onClick={() => {
                setDriver();
                router.push("/driver");
              }}
            >
              Entrar como conductor
            </Button>
          </CardContent>
        </Card>

        <Card className="border-indigo-200/60 transition-all hover:border-indigo-300 hover:shadow-md dark:border-indigo-900/50">
          <CardHeader>
            <div className="mb-2 flex size-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-300">
              <ClipboardList className="size-6" />
            </div>
            <CardTitle>{COPY.role.admin}</CardTitle>
            <CardDescription>{COPY.role.adminDesc}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/login" className="block w-full">
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300 dark:hover:bg-indigo-950"
              >
                <LogIn className="size-4" />
                Entrar como administrador
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
