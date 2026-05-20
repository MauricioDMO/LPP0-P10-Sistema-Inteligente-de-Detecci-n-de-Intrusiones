export type TimeRangeHours = 1 | 6 | 24 | 168;

export type CountBucket = {
  type?: string;
  category?: string;
  signature?: string;
  count: number;
};

export type AnalyticsOverview = {
  hours: number;
  total_events: number;
  alerts: number;
  blocked: number;
  unique_source_ips: number;
  unique_destination_ips: number;
  by_type: Array<{ type: string; count: number }>;
  by_severity: {
    critical?: number;
    high?: number;
    medium?: number;
    low?: number;
  };
};

export type TimelinePoint = {
  timestamp: string;
  total: number;
  alerts: number;
  blocked: number;
  critical: number;
};

export type AnalyticsTimeline = {
  hours: number;
  interval: string;
  points: TimelinePoint[];
};

export type TopIp = {
  ip: string;
  count: number;
  max_severity?: number;
  last_seen?: string;
  event_types?: Array<{ type: string; count: number }>;
  top_signatures?: Array<{ signature: string; count: number }>;
};

export type TopIpsResponse = {
  hours: number;
  direction: "source" | "destination";
  ips: TopIp[];
};

export type TopSignature = {
  signature: string;
  count: number;
  severity?: Record<string, number>;
  categories?: Array<{ category: string; count: number }>;
  last_seen?: string;
};

export type TopSignaturesResponse = {
  hours: number;
  signatures: TopSignature[];
};

export type BlockedAnalytics = {
  hours: number;
  total_blocked: number;
  top_signatures: Array<{ signature: string; count: number }>;
  top_source_ips: Array<{ ip: string; count: number }>;
  top_destination_ips: Array<{ ip: string; count: number }>;
  by_type: Array<{ type: string; count: number }>;
};

export type HistoricalGeoPoint = {
  lat: number;
  lon: number;
  country?: string | null;
  city?: string | null;
  isp?: string | null;
  count: number;
};

export type GeoAnalytics = {
  hours: number;
  total_events: number;
  geolocated_observations: number;
  countries: Array<{ country: string; count: number }>;
  cities: Array<{ city: string; count: number }>;
  isps: Array<{ isp: string; count: number }>;
  points: HistoricalGeoPoint[];
};
