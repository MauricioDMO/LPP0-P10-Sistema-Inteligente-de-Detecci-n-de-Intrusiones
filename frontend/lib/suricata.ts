import type { BlockSource, DashboardStats, EventFilterType, SuricataEvent } from "@/types/suricata";

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
  const signature = getSignature(evt).toLowerCase();
  return Boolean(evt._blocked) || signature.includes("bloqueo") || signature.includes("blocked") || signature.includes("suricata-list block");
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

export function getSignature(evt: SuricataEvent): string {
  return evt.suricata?.eve?.alert?.signature ?? evt.alert?.signature ?? "";
}

export function getSid(evt: SuricataEvent): number | null {
  return evt._blocked?.sid ?? evt.suricata?.eve?.alert?.signature_id ?? evt.suricata?.eve?.alert?.sid ?? evt.alert?.signature_id ?? evt.alert?.sid ?? null;
}

export function getGid(evt: SuricataEvent): number | null {
  return evt._blocked?.gid ?? evt.suricata?.eve?.alert?.gid ?? evt.suricata?.eve?.alert?.generator_id ?? evt.alert?.gid ?? evt.alert?.generator_id ?? 1;
}

export function getDomain(evt: SuricataEvent): string {
  const eve = getEve(evt);
  return evt._blocked?.domain ?? eve.dns?.queries?.[0]?.rrname ?? eve.tls?.sni ?? eve.http?.hostname ?? eve.http?.url ?? "";
}

export function getBlockSource(evt: SuricataEvent): BlockSource {
  if (evt._blocked?.source) return evt._blocked.source;
  const signature = getSignature(evt).toLowerCase();
  const sid = getSid(evt);
  if (signature.includes("suricata-list block") || signature.includes("blacklist")) return "blacklist";
  if (sid && ((sid >= 1001001 && sid <= 1001999) || (sid >= 2000000 && sid <= 2009999))) return "seed";
  if (signature.includes("[blocked]") || signature.includes("[bloqueo]")) return "local_rule";
  if (signature.includes("override")) return "override";
  if (signature) return "external_rule";
  return "other";
}

export function getBlockAction(evt: SuricataEvent): string {
  if (evt._blocked?.action) return evt._blocked.action;
  const signature = getSignature(evt).toLowerCase();
  if (signature.includes("suricata-list block") || signature.includes("blacklist")) return "blacklist";
  if (signature.includes("drop")) return "drop";
  if (signature.includes("reject") || signature.includes("bloqueo") || signature.includes("blocked")) return "reject";
  return "unknown";
}

export function explainBlock(evt: SuricataEvent): string {
  if (evt._blocked?.explanation) return evt._blocked.explanation;
  const domain = getDomain(evt) || "destino sin dominio";
  const signature = getSignature(evt) || "regla sin firma";
  const dst = getDstIP(evt) || "IP destino desconocida";
  const type = getEventType(evt).toUpperCase() || "EVE";
  const sourceLabels: Record<BlockSource, string> = {
    blacklist: "lista negra",
    local_rule: "regla local",
    override: "override",
    external_rule: "regla externa",
    seed: "regla seed",
    other: "regla",
  };
  return `${domain} bloqueado por ${sourceLabels[getBlockSource(evt)]}: ${signature}, destino ${dst}, evento ${type}`;
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
  if (filterType === "flow" && eventType !== "flow") return false;
  if (filterType === "ip" && eventType !== "ip") return false;
  if (filterSeverity > 0 && getSeverity(evt) !== filterSeverity) return false;

  const query = filterSearch.trim().toLowerCase();
  if (!query) return true;

  const values = [
    getMessage(evt),
    getDomain(evt),
    getSignature(evt),
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
