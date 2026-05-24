"use client";

import { IconAdjustments, IconBell, IconFileCode, IconListDetails, IconRefresh, IconServerCog, IconShieldCog, IconUpload } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, useState } from "react";
import { toast } from "sonner";
import { PageHeading } from "@/features/analytics/components/PageHeading";
import { applySuricataConfig, fetchSuricataStatus } from "@/lib/suricata-management-api";
import type { SuricataStatus } from "@/types/suricata-management";
import { ActionButton, formatDate, StatusPill } from "./suricata-ui";

const navItems = [
  { href: "/suricata", group: "Inicio", label: "Resumen", detail: "Estado y guía", icon: IconShieldCog },
  { href: "/suricata/profiles", group: "Configurar", label: "Perfiles", detail: "Modo IDS/IPS", icon: IconAdjustments },
  { href: "/suricata/sources", group: "Configurar", label: "Fuentes", detail: "Rulesets externos", icon: IconServerCog },
  { href: "/suricata/overrides", group: "Reglas", label: "Overrides", detail: "Cambios por SID", icon: IconListDetails },
  { href: "/suricata/custom-rules", group: "Reglas", label: "Reglas locales", detail: "Firmas propias", icon: IconFileCode },
  { href: "/suricata/notifications", group: "Alertas", label: "Notificaciones", detail: "Telegram", icon: IconBell },
];

export function SuricataManagementShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<SuricataStatus | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadStatus() {
    try {
      setStatus(await fetchSuricataStatus());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar estado Suricata");
    }
  }

  useEffect(() => {
    startTransition(() => {
      void loadStatus();
    });
  }, []);

  async function handleApply() {
    setSaving(true);
    try {
      const job = await applySuricataConfig(status?.active_profile?.id);
      await loadStatus();
      if (job.status === "success") toast.success("Configuración aplicada y Suricata recargado");
      else toast.error(job.error_message ?? "Apply falló; Suricata no fue recargado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo aplicar configuración");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen px-3 py-3 text-foreground sm:px-4 lg:px-6">
      <div className="mx-auto flex max-w-450 flex-col gap-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_24rem]">
          <PageHeading eyebrow="Políticas" title="Centro de control Suricata" description="Configura perfiles, fuentes, reglas y alertas en secciones separadas. Los cambios quedan preparados hasta que presionas Aplicar configuración." />

          <aside className="rounded-lg border border-soc-outline/80 bg-soc-low/90 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-soc-muted">Estado actual</div>
                <div className="mt-1 text-lg font-black text-white">{status?.active_profile?.name ?? "Sin perfil activo"}</div>
              </div>
              <StatusPill tone={status?.container_running ? "success" : "danger"}>{status?.container_running ? "online" : "offline"}</StatusPill>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-soc-muted">
              <div className="rounded-lg border border-soc-outline/60 bg-soc-lowest/55 p-2">
                <span className="block uppercase tracking-[0.12em]">Modo</span>
                <strong className="mt-1 block text-white">{status?.active_profile?.mode ?? "-"}</strong>
              </div>
              <div className="rounded-lg border border-soc-outline/60 bg-soc-lowest/55 p-2">
                <span className="block uppercase tracking-[0.12em]">Último apply</span>
                <strong className="mt-1 block text-white">{status?.last_job?.status ?? "sin jobs"}</strong>
              </div>
            </div>
            <p className="mt-2 font-mono text-[10px] text-soc-muted">{formatDate(status?.last_job?.created_at ?? null)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <ActionButton tone="ghost" onClick={() => window.location.reload()}><IconRefresh size={16} /> Actualizar</ActionButton>
              <ActionButton disabled={!status?.active_profile || saving} onClick={() => void handleApply()}><IconUpload size={16} /> Aplicar</ActionButton>
            </div>
          </aside>
        </div>

        <nav className="grid gap-2 md:grid-cols-2 xl:grid-cols-6" aria-label="Secciones de gestión Suricata">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link className={`group flex items-center gap-3 rounded-2xl border p-3 transition hover:-translate-y-0.5 ${active ? "border-soc-primary/65 bg-soc-blue/20 text-white shadow-[0_0_34px_rgba(77,142,255,0.18)]" : "border-soc-outline/70 bg-soc-low/80 text-soc-muted hover:border-soc-primary/35 hover:bg-soc-blue/10 hover:text-white"}`} href={item.href} key={item.href}>
                <span className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${active ? "border-soc-primary/40 bg-soc-primary/10 text-soc-primary" : "border-soc-outline/70 bg-soc-lowest text-soc-muted group-hover:text-soc-primary"}`}>
                  <Icon size={20} stroke={1.8} />
                </span>
                <span className="min-w-0">
                  <span className="block font-mono text-[9px] font-black uppercase tracking-[0.18em] text-soc-primary/80">{item.group}</span>
                  <span className="mt-0.5 block truncate text-sm font-black text-white">{item.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-soc-muted">{item.detail}</span>
                </span>
              </Link>
            );
          })}
        </nav>

        {children}
      </div>
    </main>
  );
}
