"use client";

import { IconRefresh } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchSystemOverview } from "@/lib/system-api";
import type { HealthTone, SystemOverview } from "@/types/system";

const statusLabel: Record<HealthTone, string> = {
  green: "Correcto",
  red: "Error",
  unknown: "Sin datos",
  yellow: "Atención",
};

const statusClasses: Record<HealthTone, string> = {
  green: "border-soc-success/40 bg-soc-success/10 text-green-200",
  red: "border-soc-danger/45 bg-soc-danger/10 text-red-100",
  unknown: "border-soc-outline/70 bg-soc-lowest text-soc-muted",
  yellow: "border-soc-warning/45 bg-soc-warning/10 text-yellow-100",
};

function normalizeStatus(status?: string | null): HealthTone {
  if (status === "green" || status === "yellow" || status === "red") return status;
  return "unknown";
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "medium" });
}

function formatBytes(value?: number) {
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(size >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function StatusBadge({ status }: { status?: string | null }) {
  const tone = normalizeStatus(status);
  return <span className={`inline-flex shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${statusClasses[tone]}`}>{statusLabel[tone]}</span>;
}

function Section({ children, title, description }: { children: React.ReactNode; description?: string; title: string }) {
  return (
    <section className="rounded-2xl border border-soc-outline/70 bg-soc-low/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:p-5">
      <div className="mb-4">
        <h2 className="text-lg font-black text-white">{title}</h2>
        {description ? <p className="mt-1 text-sm leading-6 text-soc-muted">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

function StatusRow({ detail, label, status, value }: { detail?: React.ReactNode; label: string; status?: string | null; value: React.ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-soc-outline/45 px-1 py-3 last:border-b-0 md:grid-cols-[11rem_1fr_auto] md:items-center">
      <div className="text-sm font-bold text-white">{label}</div>
      <div className="min-w-0 text-sm leading-6 text-soc-muted">
        <div className="break-words text-soc-muted">{value}</div>
        {detail ? <div className="mt-0.5 break-words text-xs text-soc-muted/80">{detail}</div> : null}
      </div>
      <StatusBadge status={status} />
    </div>
  );
}

function PercentBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-2 border-b border-soc-outline/45 py-3 last:border-b-0 sm:grid-cols-[9rem_1fr_4rem] sm:items-center">
      <div className="text-sm font-bold text-white">{label}</div>
      <div className="h-2 overflow-hidden rounded-full bg-soc-outline/35">
        <div className="h-full rounded-full bg-soc-primary" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <div className="font-mono text-sm text-soc-primary sm:text-right">{value}%</div>
    </div>
  );
}

function LogDetails({ lines, title }: { lines: string[]; title: string }) {
  return (
    <details className="rounded-xl border border-soc-outline/60 bg-soc-lowest/55">
      <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-white">{title}</summary>
      {lines.length > 0 ? (
        <pre className="max-h-72 overflow-auto border-t border-soc-outline/45 p-4 whitespace-pre-wrap break-words font-mono text-[11px] leading-5 text-soc-muted">{lines.join("\n")}</pre>
      ) : (
        <div className="border-t border-soc-outline/45 px-4 py-3 text-sm text-soc-muted">Sin logs recientes disponibles.</div>
      )}
    </details>
  );
}

export function SystemDashboardPage() {
  const [overview, setOverview] = useState<SystemOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  async function load({ silent = false }: { silent?: boolean } = {}) {
    if (!silent) setIsLoading(true);
    try {
      setOverview(await fetchSystemOverview());
      setUpdatedAt(new Date().toISOString());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar salud del stack");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    fetchSystemOverview()
      .then((nextOverview) => {
        if (cancelled) return;
        setOverview(nextOverview);
        setUpdatedAt(new Date().toISOString());
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : "No se pudo cargar salud del stack");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    const timer = window.setInterval(() => void load({ silent: true }), 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const health = overview?.health;
  const elastic = overview?.elasticsearch;
  const suricata = overview?.suricata_config;
  const containers = overview?.containers.containers ?? [];
  const notices = [
    elastic?.last_enriched_write_error ? `Error escribiendo índice enriquecido: ${elastic.last_enriched_write_error.message}` : null,
    suricata && !suricata.mode.matches ? `El perfil activo está en modo ${suricata.mode.profile ?? "-"}, pero el runtime parece ${suricata.mode.real}.` : null,
    suricata?.last_job?.status === "failed" ? `Último apply de Suricata falló: ${suricata.last_job.error_message ?? "sin detalle"}` : null,
  ].filter(Boolean);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
      <header className="rounded-2xl border border-soc-outline/70 bg-soc-low/85 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.22)] sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-[-0.03em] text-white sm:text-3xl">Salud del stack</h1>
          <p className="mt-1 text-sm leading-6 text-soc-muted">Resumen operativo de backend, Redis, WebSocket, Elasticsearch, Suricata, Filebeat y Logstash.</p>
          <p className="mt-1 text-xs text-soc-muted/80">Última lectura: {formatDate(updatedAt)}</p>
        </div>
        <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-soc-primary/45 bg-soc-blue/20 px-4 py-2 text-sm font-bold text-white transition hover:bg-soc-blue/30 disabled:opacity-60 sm:mt-0 sm:w-auto" disabled={isLoading} onClick={() => void load()} type="button">
          <IconRefresh size={17} stroke={1.8} />
          {isLoading ? "Actualizando" : "Actualizar"}
        </button>
      </header>

      <Section title="Estado general">
        <StatusRow label="Backend" value="API en línea" detail={updatedAt ? `Actualizado ${formatDate(updatedAt)}` : "Esperando datos"} status={health?.backend.status} />
        <StatusRow label="Redis" value={health?.redis.connected ? "Conectado" : "Desconectado"} detail={health ? `${health.redis.host}:${health.redis.port}, canal ${health.redis.channel}` : "-"} status={health?.redis.status} />
        <StatusRow label="WebSocket" value={`${health?.websocket.clients ?? 0} clientes conectados`} detail="Ruta /ws" status={health?.websocket.status} />
        <StatusRow label="Eventos" value={`${health?.pipeline.events_per_minute ?? 0} eventos/min`} detail={health?.pipeline.last_event ? `Último evento recibido ${formatDate(health.pipeline.last_event.received_at)}` : "Sin eventos recientes"} status={overview?.pipeline.status} />
      </Section>

      <Section title="Avisos" description="Solo se muestran problemas que requieren acción. El fallback de GeoIP y la ausencia de GeoLite2 se informan en la sección Elasticsearch, pero no se tratan como alerta crítica.">
        {notices.length > 0 ? (
          <div className="grid gap-2">
            {notices.map((notice) => <div className={`rounded-lg border px-3 py-2 text-sm ${statusClasses.yellow}`} key={notice}>{notice}</div>)}
          </div>
        ) : (
          <div className={`rounded-lg border px-3 py-2 text-sm ${statusClasses.green}`}>No hay avisos críticos en la última lectura.</div>
        )}
      </Section>

      <Section title="Elasticsearch">
        <StatusRow label="Cluster" value={elastic?.status ?? "Sin datos"} status={elastic?.status === "green" ? "green" : elastic?.status === "yellow" ? "yellow" : elastic?.connected ? "yellow" : "red"} />
        <StatusRow label="Template" value={elastic?.template?.exists ? "Template enriquecido instalado" : "Template enriquecido no encontrado"} detail={elastic?.template?.name} status={elastic?.template?.status} />
        <StatusRow label="GeoIP" value={elastic?.geoip?.database_available ? "GeoLite2 activo" : "Fallback ip-api.com activo"} detail={elastic?.geoip?.database_available ? elastic.geoip.database_path : "No es error: funciona, pero depende de ip-api.com."} status={elastic?.geoip?.database_available ? "green" : "yellow"} />

        <div className="mt-4 overflow-hidden rounded-xl border border-soc-outline/60">
          <div className="grid grid-cols-[1fr_5rem_6rem] gap-3 border-b border-soc-outline/60 bg-soc-lowest/60 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-soc-muted sm:grid-cols-[1fr_7rem_8rem_7rem]">
            <div>Índice</div>
            <div className="text-right">Docs</div>
            <div className="hidden text-right sm:block">Tamaño</div>
            <div className="text-right">Estado</div>
          </div>
          {elastic?.indices ? [elastic.indices.raw, elastic.indices.enriched].map((index) => (
            <div className="grid grid-cols-[1fr_5rem_6rem] gap-3 border-b border-soc-outline/45 px-3 py-3 text-sm last:border-b-0 sm:grid-cols-[1fr_7rem_8rem_7rem]" key={index.pattern}>
              <div className="min-w-0 break-words font-mono text-white">{index.pattern}</div>
              <div className="text-right text-soc-muted">{index.documents ?? 0}</div>
              <div className="hidden text-right text-soc-muted sm:block">{formatBytes(index.size_bytes)}</div>
              <div className="text-right"><StatusBadge status={index.status} /></div>
            </div>
          )) : <div className="px-3 py-3 text-sm text-soc-muted">Cargando índices...</div>}
        </div>

        {elastic?.coverage ? (
          <div className="mt-4 rounded-xl border border-soc-outline/60 px-4 py-2">
            <div className="py-2 text-sm text-soc-muted">Cobertura de enriquecimiento en las últimas {elastic.coverage.hours}h sobre {elastic.coverage.total} eventos enriquecidos.</div>
            <PercentBar label="GeoIP" value={elastic.coverage.geo.percent} />
            <PercentBar label="DNS/PTR" value={elastic.coverage.resolved.percent} />
            <PercentBar label="Threat Intel" value={elastic.coverage.threat.percent} />
          </div>
        ) : null}
      </Section>

      <Section title="Suricata">
        <StatusRow label="Contenedor" value={suricata?.container_running ? "Arriba" : "Abajo"} status={suricata?.container_running ? "green" : "red"} />
        <StatusRow label="Modo" value={`Runtime ${suricata?.mode.real ?? "-"}`} detail={`Perfil activo: ${suricata?.mode.profile ?? "sin perfil"}`} status={suricata?.mode.matches ? "green" : "yellow"} />
        <StatusRow label="Perfil" value={suricata?.active_profile?.name ?? "Sin perfil activo"} detail={suricata?.active_profile ? `Sensibilidad ${suricata.active_profile.sensitivity}` : undefined} status={suricata?.active_profile ? "green" : "yellow"} />
        <StatusRow label="Último apply" value={suricata?.last_job?.status ?? "Sin jobs"} detail={formatDate(suricata?.last_job?.created_at)} status={suricata?.last_job?.status === "success" ? "green" : suricata?.last_job?.status === "failed" ? "red" : "yellow"} />
        <StatusRow label="NFQUEUE" value={suricata?.nfqueue.present ? "Presente" : "No detectado"} detail={suricata?.nfqueue.output || undefined} status={suricata?.nfqueue.present ? "green" : "yellow"} />
        <StatusRow label="Fuentes" value={suricata?.enabled_sources.length ? suricata.enabled_sources.join(", ") : "Ninguna fuente externa habilitada"} status="green" />
        <div className="mt-4">
          <LogDetails lines={suricata?.recent_logs ?? []} title="Ver logs recientes de Suricata" />
        </div>
      </Section>

      <Section title="Contenedores">
        <div className="grid gap-3">
          {containers.map((container) => (
            <div className="rounded-xl border border-soc-outline/60 bg-soc-lowest/45 p-3" key={container.name}>
              <StatusRow label={container.name} value={container.running ? "Contenedor en ejecución" : "Contenedor detenido"} status={container.status} />
              <LogDetails lines={container.logs} title={`Ver logs de ${container.name}`} />
            </div>
          ))}
          {containers.length === 0 ? <div className="text-sm text-soc-muted">Cargando contenedores...</div> : null}
        </div>
      </Section>
    </main>
  );
}
