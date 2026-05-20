import { useMemo, useState } from "react";
import type { GeoPoint, SuricataEvent } from "@/types/suricata";
import {
  getCategory,
  getDstIP,
  getDstPort,
  getEventType,
  getFlagEmoji,
  getMessage,
  getProto,
  getSeverity,
  getSeverityLabel,
  getSrcIP,
  getSrcPort,
  getTimestamp,
} from "@/lib/suricata";

type EventTableProps = {
  events: SuricataEvent[];
};

const pageSizeOptions = [10, 25, 50];

export function EventTable({ events }: EventTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const totalPages = Math.max(1, Math.ceil(events.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, events.length);
  const visibleEvents = useMemo(() => events.slice(start, end), [end, events, start]);

  return (
    <section className="overflow-hidden rounded-lg border border-soc-outline/80 bg-soc-low/90 shadow-[0_18px_50px_rgba(0,0,0,0.22)]" aria-label="Tabla de eventos">
      <div className="flex flex-col gap-3 border-b border-soc-outline/80 px-3 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-soc-muted">Eventos recientes</h2>
          <p className="mt-1 text-xs text-soc-muted">Feed en vivo paginado para revisar sin saturar la pantalla.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-soc-muted">
          <span className="rounded border border-soc-outline bg-soc-lowest px-2 py-1">{events.length} filtrados</span>
          <span className="rounded border border-soc-outline bg-soc-lowest px-2 py-1">
            {events.length === 0 ? "0-0" : `${start + 1}-${end}`} / {events.length}
          </span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-270 w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-soc-outline bg-soc-lowest/95 text-[10px] uppercase tracking-[0.12em] text-soc-muted">
              <th className="px-2.5 py-2 font-bold">Sev</th>
              <th className="px-2.5 py-2 font-bold">Tipo</th>
              <th className="px-2.5 py-2 font-bold">Tiempo</th>
              <th className="px-2.5 py-2 font-bold">Origen</th>
              <th className="px-2.5 py-2 font-bold">Destino</th>
              <th className="px-2.5 py-2 font-bold">Red</th>
              <th className="px-2.5 py-2 font-bold">Mensaje</th>
              <th className="px-2.5 py-2 font-bold">Threat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/4.5">
            {events.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-soc-muted" colSpan={8}>Sin eventos que coincidan con los filtros activos</td>
              </tr>
            ) : (
              visibleEvents.map((event, index) => <EventRow event={event} key={`${event.timestamp ?? event["@timestamp"] ?? "event"}-${start + index}`} />)
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-3 border-t border-soc-outline/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-xs text-soc-muted">
          <span>Filas</span>
          <select
            aria-label="Filas por página"
            className="rounded border border-soc-outline bg-soc-lowest px-2 py-1.5 font-mono text-xs text-white outline-none transition focus:border-soc-primary focus:ring-2 focus:ring-soc-primary/15"
            onChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(1);
            }}
            value={pageSize}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-soc-muted">
          <button
            className="rounded border border-soc-outline bg-soc-lowest px-3 py-1.5 transition hover:border-soc-primary/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            disabled={safePage <= 1}
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            type="button"
          >
            Anterior
          </button>
          <span className="rounded border border-soc-outline bg-soc-lowest px-3 py-1.5 text-white">
            {safePage} / {totalPages}
          </span>
          <button
            className="rounded border border-soc-outline bg-soc-lowest px-3 py-1.5 transition hover:border-soc-primary/45 hover:text-white disabled:cursor-not-allowed disabled:opacity-45"
            disabled={safePage >= totalPages || events.length === 0}
            onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
            type="button"
          >
            Siguiente
          </button>
        </div>
      </div>
    </section>
  );
}

function EventRow({ event }: { event: SuricataEvent }) {
  const eventType = getEventType(event);
  const severity = getSeverity(event);
  const message = getMessage(event);
  const category = getCategory(event);
  const srcGeo = event._geo?.source;
  const dstGeo = event._geo?.destination;
  const isMalicious = event._threat?.is_malicious;
  const confidence = event._threat?.confidence ?? 0;
  const reports = event._threat?.total_reports ?? 0;
  const srcPort = getSrcPort(event);
  const dstPort = getDstPort(event);
  const proto = getProto(event);

  return (
    <tr className={`transition hover:bg-soc-blue/5 ${eventType === "alert" ? "border-l-2 border-l-soc-danger" : "border-l-2 border-l-transparent"}`}>
      <td className="px-2.5 py-2 align-top">
        <span className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${severityClass(severity)}`}>
          {getSeverityLabel(severity)} {severity > 0 ? severity : ""}
        </span>
      </td>
      <td className="px-2.5 py-2 align-top">
        <span className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest ${eventTypeClass(eventType)}`}>{eventType || "eve"}</span>
      </td>
      <td className="px-2.5 py-2 align-top font-mono text-[11px] text-soc-muted whitespace-nowrap">{getTimestamp(event)}</td>
      <td className="px-2.5 py-2 align-top">
        <Endpoint ip={getSrcIP(event)} port={srcPort} hostname={event._resolved?.source_hostname} geo={srcGeo} />
      </td>
      <td className="px-2.5 py-2 align-top">
        <Endpoint ip={getDstIP(event)} port={dstPort} hostname={event._resolved?.dest_hostname} geo={dstGeo} />
      </td>
      <td className="px-2.5 py-2 align-top">
        <div className="font-mono text-[11px] font-bold text-white">{proto || "N/A"}</div>
        <div className="mt-0.5 text-[11px] text-soc-muted">{srcPort ?? "-"} -&gt; {dstPort ?? "-"}</div>
      </td>
      <td className="max-w-85 px-2.5 py-2 align-top">
        <div className="truncate text-xs text-white" title={message}>{message}</div>
        {category ? <div className="mt-0.5 truncate text-[11px] text-soc-muted" title={category}>{category}</div> : null}
      </td>
      <td className="px-2.5 py-2 align-top">
        {isMalicious ? (
          <span className="inline-flex rounded-sm border border-soc-danger/35 bg-soc-danger/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-red-200">
            MAL {confidence}% / {reports}
          </span>
        ) : (
          <span className="inline-flex rounded-sm border border-soc-success/25 bg-soc-success/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-green-200">Limpia</span>
        )}
      </td>
    </tr>
  );
}

function Endpoint({
  ip,
  port,
  hostname,
  geo,
}: {
  ip: string;
  port: number | null;
  hostname?: string;
  geo?: GeoPoint;
}) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[11px] font-bold text-white">
        {ip || "-"}{port ? <span className="text-soc-muted">:{port}</span> : null}
      </div>
      {hostname ? <div className="mt-0.5 max-w-47.5 truncate text-[11px] text-soc-muted" title={hostname}>{hostname}</div> : null}
      {geo?.country_code || geo?.country || geo?.city ? (
        <div className="mt-0.5 max-w-47.5 truncate text-[11px] text-soc-muted">
          {geo.country_code ? <span className="mr-1">{getFlagEmoji(geo.country_code)}</span> : null}
          {[geo.city, geo.country].filter(Boolean).join(", ")}
        </div>
      ) : null}
    </div>
  );
}

function severityClass(severity: number): string {
  if (severity === 1) return "border-soc-danger/45 bg-soc-danger/20 text-red-100 shadow-[0_0_15px_rgba(239,68,68,0.2)]";
  if (severity === 2) return "border-soc-danger/35 bg-soc-danger/10 text-red-200";
  if (severity === 3) return "border-soc-warning/35 bg-soc-warning/10 text-amber-200";
  if (severity === 4) return "border-soc-primary/30 bg-soc-primary/10 text-soc-primary";
  return "border-soc-outline bg-soc-lowest text-soc-muted";
}

function eventTypeClass(type: string): string {
  if (type === "alert") return "border-soc-danger/40 bg-soc-danger/15 text-red-200";
  if (type === "dns") return "border-soc-success/30 bg-soc-success/10 text-green-200";
  if (type === "http") return "border-soc-blue/35 bg-soc-blue/10 text-soc-primary";
  if (type === "tls") return "border-purple-400/35 bg-purple-400/10 text-purple-200";
  if (type === "flow") return "border-soc-warning/30 bg-soc-warning/10 text-amber-200";
  return "border-soc-outline bg-soc-lowest text-soc-muted";
}
