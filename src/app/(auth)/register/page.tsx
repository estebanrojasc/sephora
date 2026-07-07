"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus, ArrowLeft, Mail, Lock, Key } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BrandLogo } from "@/components/common/BrandLogo";
import { useSessionStore } from "@/features/auth/session-store";

export default function RegisterPage() {
  const router = useRouter();
  const setAdminFromServer = useSessionStore((s) => s.setAdminFromServer);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registrationKey, setRegistrationKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, registrationKey }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.message ?? "Error desconocido"); return; }
      setAdminFromServer(data.user);
      router.push("/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-lighter/40 via-background to-secondary-lighter/40 dark:from-primary-darker/20 dark:via-background dark:to-secondary-darker/20" />
        <div className="absolute -top-32 right-1/4 size-80 rounded-full bg-primary/20 blur-3xl dark:bg-primary/10" />
        <div className="absolute -bottom-32 left-1/4 size-80 rounded-full bg-brand-pink/15 blur-3xl dark:bg-brand-pink/10" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.25, 0.4, 0.25, 1] }}
      >
        <Card glass className="w-full max-w-sm border-2 shadow-xl">
          <CardHeader className="space-y-1 text-center pb-4">
            <div className="mx-auto mb-2 flex justify-center">
              <BrandLogo size="md" showName={false} />
            </div>
            <CardTitle className="text-xl font-semibold">Crear cuenta</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              Crear cuenta de administrador. Necesitas la clave de registro.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs font-medium text-muted-foreground">Nombre</Label>
                <Input id="name" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
                  <Input id="email" type="email" autoComplete="email" placeholder="admin@ejemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="pl-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs font-medium text-muted-foreground">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
                  <Input id="password" type="password" autoComplete="new-password" placeholder="Mín. 8 caracteres" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required className="pl-10" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-key" className="text-xs font-medium text-muted-foreground">Clave de registro</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
                  <Input id="reg-key" type="password" placeholder="Clave secreta" value={registrationKey} onChange={(e) => setRegistrationKey(e.target.value)} required className="pl-10" />
                </div>
              </div>
              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                  <Alert variant="destructive" className="text-sm">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </motion.div>
              )}
              <Button type="submit" variant="glow" size="lg" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
                {loading ? "Creando…" : "Crear cuenta"}
              </Button>
            </form>
            <div className="mt-5 flex flex-col gap-2 text-center text-xs text-muted-foreground">
              <Link href="/login" className="underline-offset-4 transition-colors hover:text-foreground hover:underline">Ya tengo cuenta</Link>
              <Link href="/" className="inline-flex items-center justify-center gap-1 underline-offset-4 transition-colors hover:text-foreground hover:underline">
                <ArrowLeft className="size-3" /> Volver al inicio
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </main>
  );
}
