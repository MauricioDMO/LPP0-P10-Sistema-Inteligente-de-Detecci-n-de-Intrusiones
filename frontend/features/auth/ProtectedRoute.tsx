"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";

type ProtectedRouteProps = {
  roles?: string[];
  children: React.ReactNode;
};

export function ProtectedRoute({ roles = [], children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const allowed = roles.length === 0 || hasRole(...roles);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [isAuthenticated, isLoading, pathname, router]);

  if (isLoading || !isAuthenticated) {
    return <div className="min-h-screen px-4 py-6 text-sm text-soc-muted">Verificando sesión...</div>;
  }

  if (!allowed) {
    return (
      <main className="min-h-screen px-3 py-3 text-foreground sm:px-4 lg:px-6">
        <section className="mx-auto max-w-3xl rounded-lg border border-soc-danger/40 bg-soc-low/90 p-6 text-center shadow-[0_18px_60px_rgba(0,0,0,0.24)]">
          <div className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-soc-danger">Acceso restringido</div>
          <h1 className="mt-2 text-2xl font-bold text-white">No tienes permisos para esta sección</h1>
          <p className="mt-2 text-sm text-soc-muted">Esta pantalla requiere rol administrativo.</p>
          <Link className="mt-5 inline-flex rounded-md border border-soc-primary/50 bg-soc-blue/20 px-4 py-2 text-sm font-bold text-white transition hover:bg-soc-blue/30" href="/live">
            Volver al dashboard
          </Link>
        </section>
      </main>
    );
  }

  return children;
}
