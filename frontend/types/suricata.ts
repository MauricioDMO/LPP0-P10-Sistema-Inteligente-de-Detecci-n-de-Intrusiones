export type EventFilterType = "all" | "alert" | "blocked" | "dns" | "http" | "tls" | "flow" | "ip";

export type BlockSource = "blacklist" | "local_rule" | "override" | "external_rule" | "seed" | "other";

export type ConnectionStatus = "connected" | "disconnected" | "error";

export type GeoPoint = {
  country?: string;
  country_code?: string;
  city?: string;
  lat?: number;
  lon?: number;
  isp?: string;
};

export type SuricataEvent = {
  timestamp?: string;
  "@timestamp"?: string;
  event_type?: string;
  src_ip?: string;
  dest_ip?: string;
  src_port?: number;
  dest_port?: number;
  proto?: string;
  source?: { ip?: string; port?: number };
  destination?: { ip?: string; port?: number };
  network?: { transport?: string; protocol?: string };
  alert?: {
    signature?: string;
    signature_id?: number;
    sid?: number;
    gid?: number;
    generator_id?: number;
    severity?: number;
    category?: string;
  };
  dns?: {
    queries?: Array<{ rrname?: string }>;
  };
  http?: {
    hostname?: string;
    url?: string;
  };
  tls?: {
    sni?: string;
  };
  ssh?: {
    client?: { software_version?: string };
  };
  flow?: {
    alerted?: boolean;
  };
  suricata?: {
    eve?: Omit<SuricataEvent, "suricata">;
  };
  _resolved?: {
    source_hostname?: string;
    dest_hostname?: string;
  };
  _geo?: {
    source?: GeoPoint;
    destination?: GeoPoint;
  };
  _threat?: {
    is_malicious?: boolean;
    confidence?: number;
    total_reports?: number;
  };
  _blocked?: {
    action?: string;
    source?: BlockSource;
    domain?: string | null;
    gid?: number | null;
    sid?: number | null;
    rule_name?: string | null;
    explanation?: string;
  };
  event?: {
    original?: string;
  };
  type?: string;
};

export type DashboardStats = {
  total: number;
  critical: number;
  alerts: number;
  malicious: number;
  blocked: number;
  dns: number;
  uniqueIps: number;
};
