"use client";

import { IconAdjustments, IconBell, IconFileCode, IconListCheck, IconListDetails, IconRefresh, IconServerCog, IconShieldCog, IconUpload } from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SURICATA_APPLY_WS_URL } from "@/lib/config";
import { applySuricataConfig, fetchSuricataStatus } from "@/lib/suricata-management-api";
import type { ApplyMode, SuricataApplyProgressEvent, SuricataStatus } from "@/types/suricata-management";
import { ActionButton, formatDate, StatusPill } from "./suricata-ui";

const navItems = [
  { href: "/suricata", group: "Inicio", label: "Resumen", detail: "Estado y guía", icon: IconShieldCog },
  { href: "/suricata/sources", group: "Configurar", label: "Fuentes", detail: "Rulesets externos", icon: IconServerCog },
  { href: "/suricata/profiles", group: "Configurar", label: "Perfiles", detail: "Modo IDS/IPS", icon: IconAdjustments },
  { href: "/suricata/overrides", group: "Reglas", label: "Overrides", detail: "Cambios por SID", icon: IconListDetails },
  { href: "/suricata/custom-rules", group: "Reglas", label: "Reglas locales", detail: "Firmas propias", icon: IconFileCode },
  { href: "/suricata/lists", group: "Reglas", label: "Listas", detail: "Block/Allow", icon: IconListCheck },
  { href: "/suricata/notifications", group: "Alertas", label: "Notificaciones", detail: "Telegram", icon: IconBell },
];

export function SuricataManagementShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [status, setStatus] = useState<SuricataStatus | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [hasPendingSourceChanges, setHasPendingSourceChanges] = useState(false);
  const [applyProgress, setApplyProgress] = useState<SuricataApplyProgressEvent | null>(null);
  const [applyWsStatus, setApplyWsStatus] = useState<"connected" | "disconnected" | "error">("disconnected");
  const lastTerminalJobRef = useRef<string | null>(null);
  const hasSeenApplyRunningRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  async function loadStatus() {
    try {
      const nextStatus = await fetchSuricataStatus();
      setStatus(nextStatus);
      setHasPendingSourceChanges(nextStatus.sources_changed_since_last_apply);
      if (nextStatus.apply_running && nextStatus.current_apply_event) {
        setApplyProgress(nextStatus.current_apply_event);
      } else if (!nextStatus.apply_running) {
        setApplyProgress(null);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar estado Suricata");
    }
  }

  useEffect(() => {
    startTransition(() => {
      void loadStatus();
    });
  }, [pathname]);

  useEffect(() => {
    window.addEventListener("suricata-status-refresh", loadStatus);
    return () => window.removeEventListener("suricata-status-refresh", loadStatus);
  }, []);

  useEffect(() => {
    function markDirty(event: Event) {
      setHasPendingChanges(true);
      if (event instanceof CustomEvent && event.detail?.scope === "sources") setHasPendingSourceChanges(true);
    }

    window.addEventListener("suricata-config-dirty", markDirty);
    return () => window.removeEventListener("suricata-config-dirty", markDirty);
  }, []);

  useEffect(() => {
    let stopped = false;

    function connect() {
      if (stopped) return;

      try {
        wsRef.current = new WebSocket(SURICATA_APPLY_WS_URL);
      } catch {
        setApplyWsStatus("error");
        reconnectTimerRef.current = setTimeout(connect, 3000);
        return;
      }

      wsRef.current.onopen = () => setApplyWsStatus("connected");
      wsRef.current.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as unknown;
          if (isPongEvent(event)) return;
          if (!isSuricataApplyProgressEvent(event)) return;

          setApplyProgress(event);
          if (event.status === "running") hasSeenApplyRunningRef.current = true;
          if (event.status === "success") {
            setHasPendingChanges(false);
            setHasPendingSourceChanges(false);
            void loadStatus();
            if (event.job_id && lastTerminalJobRef.current !== event.job_id && hasSeenApplyRunningRef.current) {
              lastTerminalJobRef.current = event.job_id;
              toast.success(event.message);
            }
          }
          if (event.status === "failed") {
            void loadStatus();
            if (event.job_id && lastTerminalJobRef.current !== event.job_id && hasSeenApplyRunningRef.current) {
              lastTerminalJobRef.current = event.job_id;
              toast.error(event.error_message ?? event.message);
            }
          }
        } catch {
          // Ignore malformed progress messages.
        }
      };
      wsRef.current.onclose = () => {
        setApplyWsStatus("disconnected");
        if (!stopped) reconnectTimerRef.current = setTimeout(connect, 3000);
      };
      wsRef.current.onerror = () => setApplyWsStatus("error");
    }

    connect();

    return () => {
      stopped = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, []);

  async function handleApply(mode: ApplyMode = "auto") {
    setSaving(true);
    hasSeenApplyRunningRef.current = true;
    setApplyProgress({ type: "suricata_apply", timestamp: new Date().toISOString(), status: "running", step: "started", message: mode === "full" ? "Iniciando actualización completa de rulesets" : "Iniciando aplicación de cambios" });
    try {
      const job = await applySuricataConfig(undefined, mode);
      const appliedMode = job.generated_files?._apply_mode === "fast" ? "rápido" : "completo";
      await loadStatus();
      setApplyProgress({ type: "suricata_apply", timestamp: job.finished_at ?? job.created_at, job_id: job.id, profile_id: job.profile_id, status: job.status === "success" ? "success" : "failed", step: job.status, message: job.status === "success" ? `Configuración aplicada en modo ${appliedMode} y Suricata recargado` : job.error_message ?? "Apply falló; Suricata no fue recargado", error_message: job.error_message ?? undefined });
      if (job.status === "success") {
        setHasPendingChanges(false);
        setHasPendingSourceChanges(false);
        if (lastTerminalJobRef.current !== job.id) toast.success(`Configuración aplicada en modo ${appliedMode}`);
      } else if (lastTerminalJobRef.current !== job.id) {
        toast.error(job.error_message ?? "Apply falló; Suricata no fue recargado");
      }
      lastTerminalJobRef.current = job.id;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo aplicar configuración");
    } finally {
      setSaving(false);
    }
  }

  const isSourcesPage = pathname === "/suricata/sources";
  const canUpdateRulesets = hasPendingSourceChanges || Boolean(status?.sources_changed_since_last_apply);
  const displayedApplyProgress = applyProgress ?? (status?.apply_running ? ({ type: "suricata_apply", timestamp: new Date().toISOString(), status: "running", step: "started", message: "Aplicación de cambios en curso" } satisfies SuricataApplyProgressEvent) : null);
  const applyIsRunning = displayedApplyProgress?.status === "running" || Boolean(status?.apply_running);
  const currentStep = displayedApplyProgress ? stepLabel(displayedApplyProgress.step) : null;

  return (
    <main className="min-h-screen px-3 py-5 text-foreground sm:px-4 sm:py-6 lg:px-6 lg:py-8">
      <div className="mx-auto flex max-w-450 flex-col gap-6 lg:gap-8">
        <section className="rounded -mb-5 border border-soc-outline/70 bg-soc-low/90 px-3 py-3 shadow-[0_18px_60px_rgba(0,0,0,0.22)] backdrop-blur" aria-label="Estado actual de Suricata">
          <div className="grid gap-0 divide-y divide-soc-outline/35 lg:grid-cols-[minmax(15rem,1.4fr)_minmax(14rem,1fr)_minmax(16rem,1.2fr)_auto] lg:items-stretch lg:divide-x lg:divide-y-0">
            <div className="py-3 lg:py-1 lg:pr-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-soc-muted">Estado actual</div>
                  <div className="mt-1 truncate text-lg font-black text-white">{status?.active_profile?.name ?? "Sin perfil activo"}</div>
                </div>
                <StatusPill tone={status?.container_running ? "success" : "danger"}>{status?.container_running ? "online" : "offline"}</StatusPill>
              </div>
              <p className="mt-2 text-xs leading-5 text-soc-muted">Perfil activo y disponibilidad del contenedor Suricata.</p>
            </div>

            <div className="grid grid-cols-2 divide-x divide-soc-outline/35 py-3 text-xs text-soc-muted sm:grid-cols-2 lg:grid-cols-1 lg:divide-x-0 lg:divide-y lg:px-4 lg:py-1 xl:grid-cols-2 xl:divide-x xl:divide-y-0">
              <div className="px-3 lg:px-0 lg:py-3 xl:px-3 xl:py-1">
                <span className="block uppercase tracking-[0.12em]">Modo</span>
                <strong className="mt-1 block text-white">{status?.active_profile?.mode ?? "-"}</strong>
              </div>
              <div className="px-3 lg:px-0 lg:py-3 xl:px-3 xl:py-1">
                <span className="block uppercase tracking-[0.12em]">Último apply</span>
                <strong className="mt-1 block text-white">{status?.last_job?.status ?? "sin jobs"}</strong>
                <span className="mt-1 block font-mono text-[10px]">{formatDate(status?.last_job?.created_at ?? null)}</span>
              </div>
            </div>

            <div className="py-3 lg:px-4 lg:py-1">
              <div className="flex flex-wrap gap-2">
                <StatusPill tone={applyWsStatus === "connected" ? "success" : applyWsStatus === "error" ? "danger" : "warning"}>ws {applyWsStatus}</StatusPill>
                <StatusPill tone={hasPendingChanges ? "warning" : "success"}>{hasPendingChanges ? "pendiente" : "sin cambios"}</StatusPill>
                <StatusPill tone={progressTone(applyIsRunning ? displayedApplyProgress?.status : status?.last_job?.status)}>{applyIsRunning ? displayedApplyProgress?.status : status?.last_job?.status ?? "sin jobs"}</StatusPill>
                {isSourcesPage ? <StatusPill tone={canUpdateRulesets ? "warning" : "muted"}>{canUpdateRulesets ? "fuentes pendientes" : "fuentes sin cambios"}</StatusPill> : null}
              </div>
            </div>

            <div className="flex flex-col justify-center gap-2 py-3 sm:flex-row sm:flex-wrap lg:min-w-56 lg:flex-col lg:py-1 lg:pl-4">
              <ActionButton disabled={!status?.active_profile || saving} onClick={() => void handleApply("auto")}><IconUpload size={16} /> {saving ? "Aplicando" : "Aplicar cambios"}</ActionButton>
              {isSourcesPage ? <ActionButton disabled={!status?.active_profile || saving || !canUpdateRulesets} onClick={() => void handleApply("full")}><IconRefresh size={16} /> Actualizar rulesets</ActionButton> : null}
            </div>
          </div>

          {applyIsRunning ? (
            <div className="mt-3 overflow-hidden rounded border border-soc-primary/25 bg-soc-blue/10">
              <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-soc-primary shadow-[0_0_16px_rgba(77,142,255,0.75)]" aria-hidden="true" />
                  <div className="min-w-0">
                    <div className="font-mono text-[10px] font-black uppercase tracking-[0.18em] text-soc-primary">Apply en curso</div>
                    <div className="mt-1 truncate text-sm font-black text-white">{displayedApplyProgress?.message}</div>
                  </div>
                </div>
                {currentStep ? <StatusPill tone="warning">{currentStep}</StatusPill> : null}
              </div>
              <div className="h-1 overflow-hidden bg-soc-lowest/80">
                <div className="h-full w-1/3 animate-[suricata-apply-progress_1.25s_ease-in-out_infinite] rounded-full bg-soc-primary shadow-[0_0_18px_rgba(77,142,255,0.55)]" />
              </div>
              <div className="flex gap-1.5 overflow-x-auto px-3 py-2" aria-label="Pasos de apply">
                {progressSteps.map((step) => {
                  const active = displayedApplyProgress?.step === step.id;
                  const done = isAfterStep(displayedApplyProgress?.step, step.id);

                  return (
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${done ? "border-soc-success/30 bg-soc-success/5 text-green-300/85" : active ? "border-soc-primary/45 bg-soc-primary/10 text-soc-primary" : "border-soc-outline/45 bg-soc-lowest/40 text-soc-muted/65"}`} key={step.id}>
                      <span className={`h-1.5 w-1.5 rounded-full ${done ? "bg-soc-success" : active ? "animate-pulse bg-soc-primary" : "bg-soc-outline"}`} aria-hidden="true" />
                      {step.label}
                    </span>
                  );
                })}
              </div>
              {displayedApplyProgress?.error_message ? <p className="m-3 rounded-lg border border-soc-danger/35 bg-soc-danger/10 p-2 text-xs text-red-200">{displayedApplyProgress.error_message}</p> : null}
            </div>
          ) : null}
        </section>

          <nav className="grid gap-3 md:grid-cols-2 xl:grid-cols-6" aria-label="Secciones de gestión Suricata">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link className={`group flex items-center gap-2.5 rounded border px-2 py-1.5 transition hover:-translate-y-0.5 ${active ? "border-soc-primary/60 bg-soc-blue/18 text-white shadow-[0_0_28px_rgba(77,142,255,0.14)]" : "border-soc-outline/60 bg-soc-low/70 text-soc-muted hover:border-soc-primary/35 hover:bg-soc-blue/10 hover:text-white"}`} href={item.href} key={item.href}>
                <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded ${active ? "text-soc-primary" : "text-soc-muted group-hover:text-white"}`}>
                  <Icon size={24} stroke={1.75} />
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

const progressSteps = [
  { id: "syncing_lists", label: "listas" },
  { id: "rendering", label: "render" },
  { id: "writing_files", label: "escritura" },
  { id: "copying_files", label: "copia" },
  { id: "updating_sources", label: "fuentes" },
  { id: "suricata_update", label: "rulesets" },
  { id: "fast_update", label: "fast" },
  { id: "testing_config", label: "test" },
  { id: "reloading", label: "recarga" },
  { id: "waiting_reload", label: "confirmando" },
] as const;

const stepOrder = ["started", "syncing_lists", "backup", "rendering", "writing_files", "copying_files", "updating_sources", "suricata_update", "fast_update", "testing_config", "reloading", "waiting_reload", "success"];
const stepLabels: Record<string, string> = {
  backup: "backup",
  copying_files: "copying_files",
  failed: "failed",
  fast_update: "fast_update",
  rendering: "rendering",
  reloading: "reloading",
  rollback: "rollback",
  started: "started",
  success: "success",
  suricata_update: "suricata_update",
  syncing_lists: "syncing_lists",
  testing_config: "testing_config",
  updating_sources: "updating_sources",
  waiting_reload: "waiting_reload",
  writing_files: "writing_files",
};

function stepLabel(step: string) {
  return stepLabels[step] ?? step;
}

function isAfterStep(current: string | undefined, step: string) {
  if (!current) return false;
  const currentIndex = stepOrder.indexOf(current);
  const stepIndex = stepOrder.indexOf(step);
  return currentIndex !== -1 && stepIndex !== -1 && currentIndex > stepIndex;
}

function progressTone(status: string | undefined): "success" | "danger" | "warning" | "muted" {
  if (status === "success") return "success";
  if (status === "failed") return "danger";
  if (status === "running" || status === "pending") return "warning";
  return "muted";
}

function isPongEvent(value: unknown): value is { type: "pong" } {
  return typeof value === "object" && value !== null && "type" in value && value.type === "pong";
}

function isSuricataApplyProgressEvent(value: unknown): value is SuricataApplyProgressEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Partial<SuricataApplyProgressEvent>;
  return event.type === "suricata_apply" && typeof event.status === "string" && typeof event.step === "string" && typeof event.message === "string";
}
