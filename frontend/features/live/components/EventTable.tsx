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

export function EventTable({ events }: EventTableProps) {
  return (
    <section className="overflow-hidden rounded-lg border border-soc-outline/80 bg-soc-low/90 shadow-[0_18px_50px_rgba(0,0,0,0.22)]" aria-label="Tabla de eventos">
      <div className="flex items-center justify-between gap-3 border-b border-soc-outline/80 px-4 py-3">
        <div>
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-soc-muted">Eventos recientes</h2>
          <p className="mt-1 text-xs text-soc-muted">Últimos eventos del feed, enriquecidos por backend.</p>
        </div>
        <span className="rounded border border-soc-outline bg-soc-lowest px-2 py-1 font-mono text-xs text-soc-muted">{events.length} filtrados</span>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-soc-outline bg-soc-lowest/95 text-[11px] uppercase tracking-[0.12em] text-soc-muted">
              <th className="px-3 py-3 font-bold">Severidad</th>
              <th className="px-3 py-3 font-bold">Tipo</th>
              <th className="px-3 py-3 font-bold">Tiempo</th>
              <th className="px-3 py-3 font-bold">Origen</th>
              <th className="px-3 py-3 font-bold">Destino</th>
              <th className="px-3 py-3 font-bold">Red</th>
              <th className="px-3 py-3 font-bold">Mensaje / Categoría</th>
              <th className="px-3 py-3 font-bold">Threat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.045]">
            {events.length === 0 ? (
              <tr>
                <td className="px-3 py-8 text-center text-soc-muted" colSpan={8}>Sin eventos que coincidan con los filtros activos</td>
              </tr>
            ) : (
              events.slice(0, 500).map((event, index) => <EventRow event={event} key={`${event.timestamp ?? event["@timestamp"] ?? "event"}-${index}`} />)
            )}
          </tbody>
        </table>
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
      <td className="px-3 py-3 align-top">
        <span className={`inline-flex rounded-sm border px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${severityClass(severity)}`}>
          {getSeverityLabel(severity)} {severity > 0 ? severity : ""}
        </span>
      </td>
      <td className="px-3 py-3 align-top">
        <span className={`inline-flex rounded-sm border px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${eventTypeClass(eventType)}`}>{eventType || "eve"}</span>
      </td>
      <td className="px-3 py-3 align-top font-mono text-xs text-soc-muted whitespace-nowrap">{getTimestamp(event)}</td>
      <td className="px-3 py-3 align-top">
        <Endpoint ip={getSrcIP(event)} port={srcPort} hostname={event._resolved?.source_hostname} geo={srcGeo} />
      </td>
      <td className="px-3 py-3 align-top">
        <Endpoint ip={getDstIP(event)} port={dstPort} hostname={event._resolved?.dest_hostname} geo={dstGeo} />
      </td>
      <td className="px-3 py-3 align-top">
        <div className="font-mono text-xs font-bold text-white">{proto || "N/A"}</div>
        <div className="mt-1 text-xs text-soc-muted">{srcPort ?? "-"} -&gt; {dstPort ?? "-"}</div>
      </td>
      <td className="max-w-[360px] px-3 py-3 align-top">
        <div className="truncate text-sm text-white" title={message}>{message}</div>
        {category ? <div className="mt-1 truncate text-xs text-soc-muted" title={category}>{category}</div> : null}
      </td>
      <td className="px-3 py-3 align-top">
        {isMalicious ? (
          <span className="inline-flex rounded-sm border border-soc-danger/35 bg-soc-danger/15 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-red-200">
            MAL {confidence}% / {reports}
          </span>
        ) : (
          <span className="inline-flex rounded-sm border border-soc-success/25 bg-soc-success/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-green-200">Limpia</span>
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
      <div className="font-mono text-xs font-bold text-white">
        {ip || "-"}{port ? <span className="text-soc-muted">:{port}</span> : null}
      </div>
      {hostname ? <div className="mt-1 max-w-[210px] truncate text-xs text-soc-muted" title={hostname}>{hostname}</div> : null}
      {geo?.country_code || geo?.country || geo?.city ? (
        <div className="mt-1 max-w-[210px] truncate text-xs text-soc-muted">
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
