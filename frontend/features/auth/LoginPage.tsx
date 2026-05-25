"use client";

import { IconLock, IconShieldCheck } from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "./AuthProvider";

export function LoginPage() {
  const { isAuthenticated, isLoading, login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNextPath = searchParams.get("next") ?? "/live";
  const nextPath = requestedNextPath.startsWith("/") && !requestedNextPath.startsWith("//") ? requestedNextPath : "/live";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace(nextPath);
  }, [isAuthenticated, isLoading, nextPath, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      await login(username.trim(), password);
      toast.success("Sesión iniciada");
      router.replace(nextPath);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-3 py-8 text-foreground sm:px-4 lg:px-6">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-xl border border-soc-outline/80 bg-soc-low/90 shadow-[0_24px_90px_rgba(0,0,0,0.38)] backdrop-blur lg:grid-cols-[0.9fr_1.1fr]">
        <div className="relative hidden min-h-120 overflow-hidden border-r border-soc-outline/70 bg-soc-lowest/70 p-8 lg:block">
          <div className="absolute -right-18 top-10 h-56 w-56 rounded-full bg-soc-blue/20 blur-3xl" />
          <div className="absolute bottom-8 left-8 h-40 w-40 rounded-full bg-soc-orange/20 blur-3xl" />
          <div className="relative flex h-full flex-col justify-between">
            <div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-soc-primary/35 bg-soc-blue/15 text-soc-primary">
                <IconShieldCheck size={25} stroke={1.8} />
              </div>
              <div className="mt-5 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-soc-primary">Suricata Threat Ops</div>
              <h1 className="mt-3 max-w-sm text-4xl font-black tracking-tighter text-white">Acceso operativo al panel IPS</h1>
            </div>
          </div>
        </div>

        <form className="p-5 sm:p-8" onSubmit={handleSubmit}>
          <div className="mb-8">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-soc-primary/35 bg-soc-blue/15 text-soc-primary lg:hidden">
              <IconLock size={22} stroke={1.8} />
            </div>
            <div className="mt-4 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-soc-primary">Autenticación</div>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-white">Iniciar sesión</h2>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-soc-muted">Usuario</span>
              <input
                className="w-full rounded-md border border-soc-outline/80 bg-soc-lowest px-3 py-3 text-sm text-white outline-none transition placeholder:text-soc-muted/70 focus:border-soc-primary/70 focus:ring-2 focus:ring-soc-primary/15"
                onChange={(event) => setUsername(event.target.value)}
                required
                autoFocus
                value={username}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.12em] text-soc-muted">Password</span>
              <input
                className="w-full rounded-md border border-soc-outline/80 bg-soc-lowest px-3 py-3 text-sm text-white outline-none transition placeholder:text-soc-muted/70 focus:border-soc-primary/70 focus:ring-2 focus:ring-soc-primary/15"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
          </div>

          <button
            className="mt-6 inline-flex w-full items-center justify-center rounded-md border border-soc-primary/45 bg-soc-blue/30 px-4 py-3 text-sm font-black uppercase tracking-[0.12em] text-white transition hover:bg-soc-blue/40 disabled:cursor-not-allowed disabled:opacity-55"
            disabled={submitting}
            type="submit"
          >
            {submitting ? "Validando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
