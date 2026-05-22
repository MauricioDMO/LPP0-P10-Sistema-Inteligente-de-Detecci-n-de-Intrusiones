import { Suspense } from "react";
import { LoginPage } from "@/features/auth/LoginPage";

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-screen px-4 py-6 text-sm text-soc-muted">Cargando login...</div>}>
      <LoginPage />
    </Suspense>
  );
}
