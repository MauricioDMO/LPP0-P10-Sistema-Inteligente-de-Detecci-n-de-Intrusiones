"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AnalyticsShell, AnalyticsState } from "@/features/analytics/components/AnalyticsShell";
import { useAnalytics } from "@/features/analytics/hooks/useAnalytics";
import {
  explainBlock,
  getBlockAction,
  getBlockSource,
  getCategory,
  getDomain,
  getDstIP,
  getEventType,
  getFlagEmoji,
  getGid,
  getSeverity,
  getSeverityLabel,
  getSid,
  getSignature,
  getSrcIP,
  getTimestamp,
} from "@/lib/suricata";
import type { AnalyticsEventsResponse, TimeRangeHours } from "@/types/analytics";
import type { BlockSource, SuricataEvent } from "@/types/suricata";

type InvestigationEventsPanelProps = {
  hours: TimeRangeHours;
  mode: "historical" | "blocked";
};

type FilterState = {
  eventType: string;
  sourceIp: string;
  destinationIp: string;
  domain: string;
  signature: string;
  severity: string;
  blockSource: string;
};

const defaultFilters: FilterState = {
  eventType: "all",
  sourceIp: "",
  destinationIp: "",
  domain: "",
  signature: "",
  severity: "",
  blockSource: "all",
};

const limit = 50;

export function InvestigationEventsPanel({ hours, mode }: InvestigationEventsPanelProps) {
  const [filters, setFilters] = useState(defaultFilters);
  const [offset, setOffset] = useState(0);
  const [rawEvent, setRawEvent] = useState<SuricataEvent | null>(null);
  const path = useMemo(() => buildPath(mode, hours, offset, filters), [filters, hours, mode, offset]);
  const { data, loading, error } = useAnalytics<AnalyticsEventsResponse<SuricataEvent>>(path);
  const events = data?.events ?? [];
  const total = data?.total ?? 0;
  const title = mode === "blocked" ? "Eventos bloqueados recientes" : "Últimos eventos históricos";
  const description = mode === "blocked" ? "Baja de agregados a la regla, destino y explicación de cada bloqueo." : "Evidencia concreta para responder qué pasó exactamente en el rango seleccionado.";

  function updateFilter(key: keyof FilterState, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    setOffset(0);
  }

  return (
    <AnalyticsShell eyebrow="Investigación" title={title}>
      <div className="space-y-3">
        <p className="text-xs text-soc-muted">{description}</p>
        <FilterBar filters={filters} mode={mode} onChange={updateFilter} onReset={() => { setFilters(defaultFilters); setOffset(0); }} />
        <AnalyticsState loading={loading} error={error} empty={!loading && !error && events.length === 0} />
        {!loading && !error ? <EventsTable events={events} mode={mode} onRaw={setRawEvent} /> : null}
        {!loading && !error ? <Pager count={events.length} offset={offset} total={total} onNext={() => setOffset((value) => value + limit)} onPrev={() => setOffset((value) => Math.max(0, value - limit))} /> : null}
      </div>
      {rawEvent ? <RawEventDialog event={rawEvent} onClose={() => setRawEvent(null)} /> : null}
    </AnalyticsShell>
  );
}

function FilterBar({ filters, mode, onChange, onReset }: { filters: FilterState; mode: "historical" | "blocked"; onChange: (key: keyof FilterState, value: string) => void; onReset: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-2 rounded-lg border border-soc-outline bg-soc-lowest/65 p-3 md:grid-cols-2 xl:grid-cols-4">
      <Select label="Tipo" value={filters.eventType} onChange={(value) => onChange("eventType", value)} options={["all", "alert", "dns", "tls", "http", "flow", "ip"]} />
      <Input label="Origen" value={filters.sourceIp} onChange={(value) => onChange("sourceIp", value)} placeholder="192.168.1.10" />
      <Input label="Destino" value={filters.destinationIp} onChange={(value) => onChange("destinationIp", value)} placeholder="142.x.x.x" />
      <Input label="Dominio" value={filters.domain} onChange={(value) => onChange("domain", value)} placeholder="youtube.com" />
      <Input label="Firma/regla" value={filters.signature} onChange={(value) => onChange("signature", value)} placeholder="[BLOCKED]" />
      <Select label="Severidad" value={filters.severity} onChange={(value) => onChange("severity", value)} options={["", "1", "2", "3", "4"]} labels={{ "": "Todas", "1": "Crítica", "2": "Alta", "3": "Media", "4": "Baja" }} />
      {mode === "blocked" ? <Select label="Fuente" value={filters.blockSource} onChange={(value) => onChange("blockSource", value)} options={["all", "blacklist", "local_rule", "override", "external_rule", "seed", "other"]} labels={{ all: "Todas", blacklist: "Lista negra", local_rule: "Regla local", override: "Override", external_rule: "Externa", seed: "Seed", other: "Otro" }} /> : null}
      <div className="flex items-end">
        <button className="h-9 w-full rounded border border-soc-outline bg-soc-low px-3 text-xs font-bold uppercase tracking-[0.12em] text-soc-muted transition hover:border-soc-primary/50 hover:text-white" onClick={onReset} type="button">Limpiar</button>
      </div>
    </div>
  );
}

function EventsTable({ events, mode, onRaw }: { events: SuricataEvent[]; mode: "historical" | "blocked"; onRaw: (event: SuricataEvent) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-soc-outline bg-soc-lowest/45">
      <table className="min-w-320 w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-soc-outline bg-soc-lowest/95 text-[10px] uppercase tracking-[0.12em] text-soc-muted">
            <th className="px-2.5 py-2">Hora</th>
            <th className="px-2.5 py-2">Tipo</th>
            {mode === "blocked" ? <th className="px-2.5 py-2">Acción</th> : null}
            <th className="px-2.5 py-2">Origen</th>
            <th className="px-2.5 py-2">Destino</th>
            <th className="px-2.5 py-2">Dominio</th>
            <th className="px-2.5 py-2">Firma Suricata</th>
            <th className="px-2.5 py-2">Sev</th>
            {mode === "blocked" ? <th className="px-2.5 py-2">SID/GID</th> : <th className="px-2.5 py-2">País/ISP</th>}
            {mode === "blocked" ? <th className="px-2.5 py-2">Categoría</th> : null}
            <th className="px-2.5 py-2">Raw</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/4.5">
          {events.map((event, index) => <EventRow event={event} key={`${event.timestamp ?? event["@timestamp"] ?? "event"}-${index}`} mode={mode} onRaw={onRaw} />)}
        </tbody>
      </table>
    </div>
  );
}

function EventRow({ event, mode, onRaw }: { event: SuricataEvent; mode: "historical" | "blocked"; onRaw: (event: SuricataEvent) => void }) {
  const severity = getSeverity(event);
  const source = getBlockSource(event);
  return (
    <tr className="align-top transition hover:bg-soc-blue/5">
      <td className="whitespace-nowrap px-2.5 py-2 font-mono text-[11px] text-soc-muted">{getTimestamp(event)}</td>
      <td className="px-2.5 py-2"><Badge>{getEventType(event) || "eve"}</Badge></td>
      {mode === "blocked" ? <td className="px-2.5 py-2"><Badge tone="warning">{getBlockAction(event)}</Badge><div className="mt-1 text-[11px] text-soc-muted">{sourceLabel(source)}</div></td> : null}
      <td className="px-2.5 py-2 font-mono text-[11px] text-white">{getSrcIP(event) || "-"}</td>
      <td className="px-2.5 py-2 font-mono text-[11px] text-white">{getDstIP(event) || "-"}</td>
      <td className="max-w-50 px-2.5 py-2"><div className="truncate font-mono text-[11px] text-soc-primary" title={getDomain(event)}>{getDomain(event) || "-"}</div></td>
      <td className="max-w-95 px-2.5 py-2">
        <div className="truncate text-xs text-white" title={getSignature(event)}>{getSignature(event) || "-"}</div>
        {mode === "blocked" ? <div className="mt-1 line-clamp-2 text-[11px] text-amber-100/90" title={explainBlock(event)}>{explainBlock(event)}</div> : null}
      </td>
      <td className="px-2.5 py-2"><Badge tone={severity <= 2 && severity > 0 ? "danger" : "neutral"}>{getSeverityLabel(severity)} {severity || ""}</Badge></td>
      {mode === "blocked" ? <td className="px-2.5 py-2 font-mono text-[11px] text-soc-muted">{getGid(event) ?? "-"}:{getSid(event) ?? "-"}</td> : <td className="px-2.5 py-2"><GeoCell event={event} /></td>}
      {mode === "blocked" ? <td className="max-w-45 px-2.5 py-2"><div className="truncate text-[11px] text-soc-muted" title={getCategory(event)}>{getCategory(event) || "-"}</div></td> : null}
      <td className="px-2.5 py-2"><button className="rounded border border-soc-outline px-2 py-1 font-mono text-[10px] uppercase text-soc-muted transition hover:border-soc-primary hover:text-white" onClick={() => onRaw(event)} type="button">Ver</button></td>
    </tr>
  );
}

function GeoCell({ event }: { event: SuricataEvent }) {
  const geo = event._geo?.destination ?? event._geo?.source;
  if (!geo) return <span className="text-[11px] text-soc-muted">-</span>;
  return (
    <div className="max-w-50 text-[11px] text-soc-muted">
      <div className="truncate">{geo.country_code ? <span className="mr-1">{getFlagEmoji(geo.country_code)}</span> : null}{[geo.city, geo.country].filter(Boolean).join(", ") || "-"}</div>
      {geo.isp ? <div className="truncate" title={geo.isp}>{geo.isp}</div> : null}
    </div>
  );
}

function Pager({ count, offset, total, onNext, onPrev }: { count: number; offset: number; total: number; onNext: () => void; onPrev: () => void }) {
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + count, total);
  return (
    <div className="flex flex-col gap-2 text-xs text-soc-muted sm:flex-row sm:items-center sm:justify-between">
      <span className="font-mono">{start}-{end} / {total}</span>
      <div className="flex gap-2">
        <button className="rounded border border-soc-outline bg-soc-lowest px-3 py-1.5 transition hover:border-soc-primary/45 hover:text-white disabled:opacity-45" disabled={offset <= 0} onClick={onPrev} type="button">Anterior</button>
        <button className="rounded border border-soc-outline bg-soc-lowest px-3 py-1.5 transition hover:border-soc-primary/45 hover:text-white disabled:opacity-45" disabled={offset + count >= total || count === 0} onClick={onNext} type="button">Siguiente</button>
      </div>
    </div>
  );
}

function RawEventDialog({ event, onClose }: { event: SuricataEvent; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3" role="dialog" aria-modal="true">
      <div className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-xl border border-soc-outline bg-soc-low shadow-2xl">
        <div className="flex items-center justify-between border-b border-soc-outline px-4 py-3">
          <h3 className="text-xs font-black uppercase tracking-[0.14em] text-white">Raw event</h3>
          <button className="rounded border border-soc-outline px-3 py-1 text-xs text-soc-muted hover:text-white" onClick={onClose} type="button">Cerrar</button>
        </div>
        <pre className="max-h-[72vh] overflow-auto p-4 text-[11px] leading-relaxed text-soc-muted">{JSON.stringify(event, null, 2)}</pre>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-soc-muted">
      {label}
      <input className="mt-1 h-9 w-full rounded border border-soc-outline bg-soc-low px-2 font-mono text-xs text-white outline-none transition placeholder:text-soc-muted/55 focus:border-soc-primary focus:ring-2 focus:ring-soc-primary/15" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} value={value} />
    </label>
  );
}

function Select({ label, value, onChange, options, labels = {} }: { label: string; value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <label className="text-[10px] font-bold uppercase tracking-[0.12em] text-soc-muted">
      {label}
      <select className="mt-1 h-9 w-full rounded border border-soc-outline bg-soc-low px-2 font-mono text-xs text-white outline-none transition focus:border-soc-primary focus:ring-2 focus:ring-soc-primary/15" onChange={(event) => onChange(event.target.value)} value={value}>
        {options.map((option) => <option key={option} value={option}>{labels[option] ?? option.toUpperCase()}</option>)}
      </select>
    </label>
  );
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "warning" | "danger" }) {
  const className = tone === "warning" ? "border-soc-warning/35 bg-soc-warning/10 text-amber-200" : tone === "danger" ? "border-soc-danger/35 bg-soc-danger/10 text-red-200" : "border-soc-outline bg-soc-lowest text-soc-muted";
  return <span className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${className}`}>{children}</span>;
}

function sourceLabel(source: BlockSource): string {
  return {
    blacklist: "Lista negra",
    local_rule: "Regla local",
    override: "Override",
    external_rule: "Regla externa",
    seed: "YouTube/adulto seed",
    other: "Otro",
  }[source];
}

function buildPath(mode: "historical" | "blocked", hours: TimeRangeHours, offset: number, filters: FilterState): string {
  const params = new URLSearchParams({ hours: String(hours), limit: String(limit), offset: String(offset) });
  if (filters.eventType !== "all") params.set("event_type", filters.eventType);
  if (filters.sourceIp.trim()) params.set("source_ip", filters.sourceIp.trim());
  if (filters.destinationIp.trim()) params.set("destination_ip", filters.destinationIp.trim());
  if (filters.domain.trim()) params.set("domain", filters.domain.trim());
  if (filters.signature.trim()) params.set("signature", filters.signature.trim());
  if (filters.severity) params.set("severity", filters.severity);
  if (mode === "blocked") {
    if (filters.blockSource !== "all") params.set("block_source", filters.blockSource);
    return `/api/analytics/blocked/events?${params.toString()}`;
  }
  return `/api/analytics/events?${params.toString()}`;
}
