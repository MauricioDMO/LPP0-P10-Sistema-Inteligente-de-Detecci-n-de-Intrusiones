import type { DashboardStats, EventFilterType, SuricataEvent } from "@/types/suricata";

const RELEVANT_TYPES = new Set(["alert", "dns", "http", "tls", "ssh", "ftp", "smtp", "flow"]);

export function getEve(evt: SuricataEvent): SuricataEvent {
  return evt.suricata?.eve ?? evt;
}

export function getEventType(evt: SuricataEvent): string {
  return (evt.suricata?.eve?.event_type ?? evt.event_type ?? "").toLowerCase();
}

export function getSrcIP(evt: SuricataEvent): string {
  return evt.source?.ip ?? evt.src_ip ?? "";
}

export function getDstIP(evt: SuricataEvent): string {
  return evt.destination?.ip ?? evt.dest_ip ?? "";
}

export function getSrcPort(evt: SuricataEvent): number | null {
  return evt.source?.port ?? evt.src_port ?? null;
}

export function getDstPort(evt: SuricataEvent): number | null {
  return evt.destination?.port ?? evt.dest_port ?? null;
}

export function getProto(evt: SuricataEvent): string {
  return (evt.network?.transport ?? evt.network?.protocol ?? evt.proto ?? "").toUpperCase();
}

export function isBlocked(evt: SuricataEvent): boolean {
  const signature = evt.suricata?.eve?.alert?.signature ?? evt.alert?.signature ?? "";
  return signature.toLowerCase().includes("bloqueo");
}

export function getSeverity(evt: SuricataEvent): number {
  return evt.suricata?.eve?.alert?.severity ?? evt.alert?.severity ?? 0;
}

export function getSeverityLabel(severity: number): string {
  if (severity === 1) return "Crítica";
  if (severity === 2) return "Alta";
  if (severity === 3) return "Media";
  if (severity === 4) return "Baja";
  return "Info";
}

export function getCategory(evt: SuricataEvent): string {
  return evt.suricata?.eve?.alert?.category ?? evt.alert?.category ?? "";
}

export function getMessage(evt: SuricataEvent): string {
  const eventType = getEventType(evt);
  const eve = getEve(evt);

  if (eventType === "alert") return eve.alert?.signature ?? "Alerta";
  if (eventType === "dns") {
    const rrname = eve.dns?.queries?.[0]?.rrname;
    return rrname ? `DNS: ${rrname}` : "DNS Query";
  }
  if (eventType === "http") return eve.http?.hostname ?? eve.http?.url ?? "HTTP";
  if (eventType === "tls") return eve.tls?.sni ?? "TLS";
  if (eventType === "ssh") return eve.ssh?.client?.software_version ?? "SSH";
  return eventType;
}

export function getTimestamp(evt: SuricataEvent): string {
  const ts = evt.timestamp ?? evt["@timestamp"] ?? "";
  if (!ts) return "";

  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return "";
  }
}

export function getTimestampMs(evt: SuricataEvent): number | null {
  const ts = evt.timestamp ?? evt["@timestamp"];
  if (!ts) return null;

  const value = new Date(ts).getTime();
  return Number.isNaN(value) ? null : value;
}

export function getFlagEmoji(code?: string): string {
  if (!code || code.length !== 2) return "";

  const offset = 0x1f1e6 - 65;
  const upper = code.toUpperCase();
  return String.fromCodePoint(upper.charCodeAt(0) + offset, upper.charCodeAt(1) + offset);
}

export function isRelevantEvent(evt: SuricataEvent): boolean {
  const eventType = getEventType(evt);
  return RELEVANT_TYPES.has(eventType) || (eventType === "flow" && Boolean(evt.suricata?.eve?.flow?.alerted));
}

export function buildStats(events: SuricataEvent[]): DashboardStats {
  const ips = new Set<string>();
  const stats: DashboardStats = {
    total: 0,
    critical: 0,
    alerts: 0,
    malicious: 0,
    blocked: 0,
    dns: 0,
    uniqueIps: 0,
  };

  for (const evt of events) {
    const eventType = getEventType(evt);
    if (!isRelevantEvent(evt)) continue;

    stats.total += 1;
    if (getSeverity(evt) === 1 || getSeverity(evt) === 2) stats.critical += 1;
    if (eventType === "alert") {
      stats.alerts += 1;
      if (isBlocked(evt)) stats.blocked += 1;
    }
    if (eventType === "dns") stats.dns += 1;
    if (evt._threat?.is_malicious) stats.malicious += 1;

    const src = getSrcIP(evt);
    const dst = getDstIP(evt);
    if (src) ips.add(src);
    if (dst) ips.add(dst);
  }

  stats.uniqueIps = ips.size;
  return stats;
}

export function buildTypeCounts(events: SuricataEvent[]): Record<string, number> {
  return events.reduce<Record<string, number>>((acc, evt) => {
    const eventType = getEventType(evt);
    if (!eventType) return acc;
    acc[eventType] = (acc[eventType] ?? 0) + 1;
    return acc;
  }, {});
}

export function buildMinuteBuckets(events: SuricataEvent[]): { labels: string[]; values: number[] } {
  const now = Date.now();
  const entries = Array.from({ length: 10 }, (_, index) => {
    const date = new Date(now - (9 - index) * 60_000);
    return { minute: date.getMinutes(), label: `:${String(date.getMinutes()).padStart(2, "0")}`, value: 0 };
  });

  for (const evt of events) {
    const ts = getTimestampMs(evt);
    if (!ts) continue;

    const minute = new Date(ts).getMinutes();
    const bucket = entries.find((entry) => entry.minute === minute);
    if (bucket) bucket.value += 1;
  }

  return {
    labels: entries.map((entry) => entry.label),
    values: entries.map((entry) => entry.value),
  };
}

export function matchesFilter(
  evt: SuricataEvent,
  filterType: EventFilterType,
  filterSeverity: number,
  filterSearch: string,
): boolean {
  const eventType = getEventType(evt);

  if (filterType === "alert" && eventType !== "alert") return false;
  if (filterType === "blocked" && (!isBlocked(evt) || eventType !== "alert")) return false;
  if (filterType === "dns" && eventType !== "dns") return false;
  if (filterType === "http" && eventType !== "http") return false;
  if (filterType === "tls" && eventType !== "tls") return false;
  if (filterSeverity > 0 && getSeverity(evt) !== filterSeverity) return false;

  const query = filterSearch.trim().toLowerCase();
  if (!query) return true;

  const values = [
    getMessage(evt),
    getSrcIP(evt),
    getDstIP(evt),
    getProto(evt),
    getCategory(evt),
    evt._resolved?.source_hostname ?? "",
    evt._resolved?.dest_hostname ?? "",
    evt._geo?.source?.country ?? "",
    evt._geo?.source?.city ?? "",
    evt._geo?.source?.isp ?? "",
    evt._geo?.destination?.country ?? "",
    evt._geo?.destination?.city ?? "",
    evt._geo?.destination?.isp ?? "",
  ];

  return values.some((value) => value.toLowerCase().includes(query));
}
