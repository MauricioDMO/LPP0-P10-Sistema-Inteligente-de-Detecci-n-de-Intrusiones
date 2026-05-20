export type EventFilterType = "all" | "alert" | "blocked" | "dns" | "http" | "tls";

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
  source?: { ip?: string };
  destination?: { ip?: string };
  alert?: {
    signature?: string;
    severity?: number;
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
  type?: string;
};

export type DashboardStats = {
  total: number;
  alerts: number;
  malicious: number;
  blocked: number;
  dns: number;
  uniqueIps: number;
};
