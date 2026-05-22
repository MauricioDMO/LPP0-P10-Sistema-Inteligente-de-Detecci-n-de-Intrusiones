"use client";

import { AnalyticsShell, AnalyticsState } from "@/features/analytics/components/AnalyticsShell";
import { useAnalytics } from "@/features/analytics/hooks/useAnalytics";
import type { AnalyticsOverview as AnalyticsOverviewData, TimeRangeHours } from "@/types/analytics";

type AnalyticsOverviewProps = {
  hours: TimeRangeHours;
};

export function AnalyticsOverview({ hours }: AnalyticsOverviewProps) {
  const { data, loading, error } = useAnalytics<AnalyticsOverviewData>(`/api/analytics/overview?hours=${hours}`);

  if (loading || error || !data) return <AnalyticsState loading={loading} error={error} empty={!data} />;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Resumen histórico">
      <MetricCard label="Eventos" value={data.total_events} accent="bg-soc-primary" />
      <MetricCard label="Alertas" value={data.alerts} accent="bg-soc-danger" valueClass="text-red-200" />
      <MetricCard label="Bloqueos" value={data.blocked} accent="bg-soc-warning" valueClass="text-amber-200" />
      <MetricCard label="Origen únicas" value={data.unique_source_ips} accent="bg-soc-blue" />
      <MetricCard label="Destino únicas" value={data.unique_destination_ips} accent="bg-soc-success" valueClass="text-green-200" />
      <MetricCard label="Críticas" value={data.by_severity.critical ?? 0} accent="bg-red-500" valueClass="text-red-300" />
    </div>
  );
}

export function HistoricalOverviewSection({ hours }: AnalyticsOverviewProps) {
  return (
    <AnalyticsShell eyebrow="Elasticsearch" title="Resumen histórico">
      <AnalyticsOverview hours={hours} />
    </AnalyticsShell>
  );
}

function MetricCard({ label, value, accent, valueClass = "text-white" }: { label: string; value: number; accent: string; valueClass?: string }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-soc-outline/80 bg-soc-lowest/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className={`mb-3 h-1 w-8 rounded-full ${accent}`} />
      <div className={`font-mono text-3xl font-bold leading-none tracking-[-0.04em] ${valueClass}`}>{value}</div>
      <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-soc-muted">{label}</div>
    </div>
  );
}
