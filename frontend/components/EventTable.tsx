import type { SuricataEvent } from "@/types/suricata";
import { getDstIP, getEventType, getFlagEmoji, getMessage, getSeverity, getSrcIP, getTimestamp } from "@/lib/suricata";

type EventTableProps = {
  events: SuricataEvent[];
};

export function EventTable({ events }: EventTableProps) {
  return (
    <section className="event-table-wrap" aria-label="Tabla de eventos">
      <table className="event-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Tiempo</th>
            <th>Origen</th>
            <th>Destino</th>
            <th>Mensaje / Dominio</th>
            <th>Threat</th>
          </tr>
        </thead>
        <tbody>
          {events.length === 0 ? (
            <tr>
              <td className="empty-row" colSpan={6}>Sin eventos que coincidan</td>
            </tr>
          ) : (
            events.slice(0, 100).map((event, index) => <EventRow event={event} key={`${event.timestamp ?? event["@timestamp"] ?? "event"}-${index}`} />)
          )}
        </tbody>
      </table>
    </section>
  );
}

function EventRow({ event }: { event: SuricataEvent }) {
  const eventType = getEventType(event);
  const severity = getSeverity(event);
  const message = getMessage(event);
  const srcGeo = event._geo?.source;
  const dstGeo = event._geo?.destination;
  const isMalicious = event._threat?.is_malicious;
  const confidence = event._threat?.confidence ?? 0;
  const reports = event._threat?.total_reports ?? 0;
  const tagClass = `tag-${eventType === "alert" ? "alert" : eventType}`;
  const severityClass = severity === 1 || severity === 2 ? "severity-high" : severity === 3 ? "severity-medium" : severity === 4 ? "severity-low" : "";

  return (
    <tr className={eventType === "alert" ? "alert-row" : ""}>
      <td><span className={`tag ${tagClass}`}>{eventType.toUpperCase()}</span></td>
      <td className="timestamp">{getTimestamp(event)}</td>
      <td className={severityClass}>
        {getSrcIP(event)} {event._resolved?.source_hostname ? <span className="hostname">({event._resolved.source_hostname})</span> : null} {srcGeo?.country_code ? <span className="flag">{getFlagEmoji(srcGeo.country_code)}</span> : null}
      </td>
      <td>
        {getDstIP(event)} {event._resolved?.dest_hostname ? <span className="hostname">({event._resolved.dest_hostname})</span> : null} {dstGeo?.country_code ? <span className="flag">{getFlagEmoji(dstGeo.country_code)}</span> : null}
      </td>
      <td>{eventType === "dns" && message.startsWith("DNS:") ? <span className="dns-domain">{message}</span> : message}</td>
      <td>{isMalicious ? <span className="threat-badge">MAL {confidence}% ({reports})</span> : null}</td>
    </tr>
  );
}
