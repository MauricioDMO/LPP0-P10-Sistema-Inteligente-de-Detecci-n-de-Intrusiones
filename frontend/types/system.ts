import type { ApplyJob, SuricataProfile } from "@/types/suricata-management";

export type HealthTone = "green" | "yellow" | "red" | "unknown";

export type SystemLastEvent = {
  received_at: string;
  timestamp: string | null;
  event_type: string | null;
  source_ip: string | null;
  destination_ip: string | null;
  signature: string | null;
};

export type SystemHealth = {
  status: HealthTone;
  backend: { status: HealthTone; timestamp: string };
  redis: { status: HealthTone; connected: boolean; host: string; port: number; channel: string };
  websocket: { status: HealthTone; path: string; clients: number };
  pipeline: { last_event: SystemLastEvent | null; events_per_minute: number };
};

export type ElasticsearchSummary = {
  pattern: string;
  exists: boolean;
  status: HealthTone;
  index_count?: number;
  documents?: number;
  size_bytes?: number;
  error?: string;
};

export type ElasticsearchHealth = {
  connected: boolean;
  status: string;
  error?: string;
  cluster?: Record<string, unknown>;
  indices?: { raw: ElasticsearchSummary; enriched: ElasticsearchSummary };
  latest_raw_event?: Record<string, unknown> | null;
  latest_enriched_event?: Record<string, unknown> | null;
  coverage?: {
    hours: number;
    total: number;
    geo: { count: number; percent: number };
    resolved: { count: number; percent: number };
    threat: { count: number; percent: number };
  };
  template?: { name: string; exists: boolean; status: HealthTone };
  geoip?: { mode: string; database_path: string; database_available: boolean };
  last_enriched_write_error?: { timestamp: string; message: string } | null;
};

export type PipelineHealth = {
  status: HealthTone;
  redis_connected: boolean;
  websocket_clients: number;
  last_event: SystemLastEvent | null;
  events_per_minute: number;
  last_enriched_write_error: { timestamp: string; message: string } | null;
};

export type ContainerHealth = {
  name: string;
  running: boolean;
  status: HealthTone;
  logs: string[];
};

export type ContainersHealth = {
  status: HealthTone;
  containers: ContainerHealth[];
};

export type SuricataConfigHealth = {
  status: HealthTone;
  container_running: boolean;
  mode: { real: "IDS" | "IPS"; profile: "IDS" | "IPS" | null; matches: boolean };
  nfqueue: { present: boolean; output: string };
  active_profile: SuricataProfile | null;
  last_job: ApplyJob | null;
  last_config_version: { id: string; profile_id: string; apply_job_id: string | null; status: string; created_at: string } | null;
  enabled_sources: string[];
  recent_logs: string[];
};

export type SystemOverview = {
  health: SystemHealth;
  elasticsearch: ElasticsearchHealth;
  pipeline: PipelineHealth;
  containers: ContainersHealth;
  suricata_config: SuricataConfigHealth;
};
