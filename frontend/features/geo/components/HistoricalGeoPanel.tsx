"use client";

import { AnalyticsShell, AnalyticsState } from "@/features/analytics/components/AnalyticsShell";
import { useAnalytics } from "@/features/analytics/hooks/useAnalytics";
import { GeoMap } from "@/shared/components/maps/GeoMap";
import type { GeoAnalytics, TimeRangeHours } from "@/types/analytics";

type HistoricalGeoPanelProps = {
  hours: TimeRangeHours;
};

export function HistoricalGeoPanel({ hours }: HistoricalGeoPanelProps) {
  const { data, loading, error } = useAnalytics<GeoAnalytics>(`/api/analytics/geo?hours=${hours}`);
  const points = data?.points ?? [];

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div>
        <AnalyticsState loading={loading} error={error} empty={points.length === 0} />
        {!loading && !error && points.length > 0 ? (
          <GeoMap mode="heatmap" points={points} title="Mapa de calor histórico" subtitle={`${points.length} zonas / ${data?.geolocated_observations ?? 0} observaciones / ${data?.total_events ?? 0} eventos`} />
        ) : null}
      </div>
      <AnalyticsShell eyebrow="Geo rankings" title="Países, ciudades e ISPs">
        <AnalyticsState loading={loading} error={error} empty={!data} />
        {!loading && !error && data ? (
          <div className="grid grid-cols-1 gap-3">
            <GeoRank title="Países" items={data.countries.map((item) => ({ label: item.country, count: item.count }))} />
            <GeoRank title="Ciudades" items={data.cities.map((item) => ({ label: item.city, count: item.count }))} />
            <GeoRank title="ISPs" items={data.isps.map((item) => ({ label: item.isp, count: item.count }))} />
          </div>
        ) : null}
      </AnalyticsShell>
    </div>
  );
}

function GeoRank({ title, items }: { title: string; items: Array<{ label: string; count: number }> }) {
  const max = Math.max(1, ...items.map((item) => item.count));

  return (
    <div className="rounded-lg border border-soc-outline bg-soc-lowest/65 p-3">
      <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.14em] text-soc-muted">{title}</h3>
      <div className="space-y-2">
        {items.length === 0 ? <div className="text-xs text-soc-muted">Sin datos</div> : null}
        {items.slice(0, 6).map((item) => (
          <div className="space-y-1" key={item.label}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-white" title={item.label}>{item.label || "N/A"}</span>
              <span className="font-mono font-bold text-soc-primary">{item.count}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-soc-outline/25">
              <div className="h-full rounded-full bg-linear-to-r from-soc-blue via-soc-warning to-soc-danger" style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
