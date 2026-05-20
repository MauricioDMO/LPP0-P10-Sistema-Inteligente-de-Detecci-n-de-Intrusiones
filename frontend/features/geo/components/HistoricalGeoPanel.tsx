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
  const topPoint = points[0];
  const coverage = data?.total_events ? Math.round(((data.geolocated_observations ?? 0) / data.total_events) * 100) : 0;
  const topCountry = data?.countries[0];
  const topCity = data?.cities[0];
  const topIsp = data?.isps[0];

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="space-y-3">
        {!loading && !error && data ? (
          <GeoSummary
            coverage={coverage}
            geolocatedObservations={data.geolocated_observations}
            pointsCount={points.length}
            topCountry={topCountry?.country}
            topCountryCount={topCountry?.count}
            topIsp={topIsp?.isp}
            topPoint={topPoint}
            totalEvents={data.total_events}
          />
        ) : null}
        <AnalyticsState loading={loading} error={error} empty={points.length === 0} />
        {!loading && !error && points.length > 0 ? (
          <GeoMap mode="heatmap" points={points} title="Mapa de calor histórico" subtitle={`${points.length} zonas / ${data?.geolocated_observations ?? 0} observaciones / ${data?.total_events ?? 0} eventos`} />
        ) : null}
      </div>
      <AnalyticsShell eyebrow="Geo rankings" title="Concentración geográfica">
        <AnalyticsState loading={loading} error={error} empty={!data} />
        {!loading && !error && data ? (
          <div className="grid grid-cols-1 gap-3">
            {topPoint ? <TopLocation point={topPoint} total={data.geolocated_observations} /> : null}
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <GeoRank title="Países" items={data.countries.map((item) => ({ label: item.country, count: item.count }))} total={data.geolocated_observations} />
              <GeoRank title="Ciudades" items={data.cities.map((item) => ({ label: item.city, count: item.count }))} total={data.geolocated_observations} highlight={topCity?.city} />
              <GeoRank title="ISPs" items={data.isps.map((item) => ({ label: item.isp, count: item.count }))} total={data.geolocated_observations} />
            </div>
          </div>
        ) : null}
      </AnalyticsShell>
    </div>
  );
}

function GeoSummary({
  coverage,
  geolocatedObservations,
  pointsCount,
  topCountry,
  topCountryCount,
  topIsp,
  topPoint,
  totalEvents,
}: {
  coverage: number;
  geolocatedObservations: number;
  pointsCount: number;
  topCountry?: string;
  topCountryCount?: number;
  topIsp?: string;
  topPoint?: GeoAnalytics["points"][number];
  totalEvents: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Resumen geográfico">
      <GeoMetric label="Eventos" value={formatNumber(totalEvents)} caption="Eventos enriquecidos encontrados dentro del rango de tiempo seleccionado." accent="bg-soc-primary" />
      <GeoMetric label="Geo obs." value={formatNumber(geolocatedObservations)} caption="Suma de ubicaciones válidas; un evento puede aportar origen y destino." accent="bg-soc-success" valueClass="text-green-200" />
      <GeoMetric label="Ratio geo" value={`${coverage}%`} caption="Observaciones geográficas frente al total de eventos; puede sumar origen y destino." accent="bg-soc-blue" />
      <GeoMetric label="Zonas" value={formatNumber(pointsCount)} caption="Coordenadas únicas agrupadas para el mapa de calor." accent="bg-soc-warning" valueClass="text-amber-200" />
      <GeoMetric label="Top país" value={topCountry ?? "N/A"} caption="País con mayor cantidad de observaciones geográficas." detail={topCountryCount ? `${formatNumber(topCountryCount)} obs.` : undefined} accent="bg-soc-danger" valueClass="text-red-200" compact />
      <GeoMetric label="Top zona" value={formatLocation(topPoint)} caption="Ubicación puntual con mayor concentración de eventos." detail={topIsp ?? "ISP no disponible"} accent="bg-white" compact />
    </div>
  );
}

function GeoMetric({ label, value, caption, accent, detail, valueClass = "text-white", compact = false }: { label: string; value: string; caption: string; accent: string; detail?: string; valueClass?: string; compact?: boolean }) {
  return (
    <div className="relative flex min-h-44 flex-col overflow-hidden rounded-lg border border-soc-outline/80 bg-soc-lowest/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className={`mb-3 h-1 w-8 rounded-full ${accent}`} />
      <div className={`font-mono font-bold leading-none tracking-[-0.04em] ${compact ? "truncate text-lg" : "text-3xl"} ${valueClass}`} title={value}>{value}</div>
      {detail ? <div className="mt-2 truncate text-xs text-soc-muted" title={detail}>{detail}</div> : null}
      <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-soc-muted">{label}</div>
      <p className="mt-auto pt-3 text-[11px] leading-4 text-soc-muted/85">{caption}</p>
    </div>
  );
}

function TopLocation({ point, total }: { point: GeoAnalytics["points"][number]; total: number }) {
  const percent = getPercent(point.count, total);

  return (
    <div className="overflow-hidden rounded-lg border border-soc-blue/35 bg-soc-blue/10 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-soc-primary">Zona principal</h3>
        <span className="rounded-full border border-soc-primary/25 bg-soc-lowest px-2 py-1 font-mono text-[10px] font-bold text-soc-primary">{percent}%</span>
      </div>
      <div className="truncate text-sm font-bold text-white" title={formatLocation(point)}>{formatLocation(point)}</div>
      <div className="mt-1 truncate text-xs text-soc-muted" title={point.isp ?? undefined}>{point.isp ?? "ISP no disponible"}</div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <MiniStat label="Eventos" value={formatNumber(point.count)} />
        <MiniStat label="Lat" value={point.lat.toFixed(2)} />
        <MiniStat label="Lon" value={point.lon.toFixed(2)} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-soc-outline/60 bg-soc-lowest/70 px-2 py-2">
      <div className="font-mono text-sm font-bold text-white">{value}</div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-soc-muted">{label}</div>
    </div>
  );
}

function GeoRank({ title, items, total, highlight }: { title: string; items: Array<{ label: string; count: number }>; total: number; highlight?: string }) {
  const max = Math.max(1, ...items.map((item) => item.count));

  return (
    <div className="rounded-lg border border-soc-outline bg-soc-lowest/65 p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-[10px] font-black uppercase tracking-[0.14em] text-soc-muted">{title}</h3>
        <span className="font-mono text-[10px] text-soc-muted">top {Math.min(items.length, 8)}</span>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? <div className="text-xs text-soc-muted">Sin datos</div> : null}
        {items.slice(0, 8).map((item) => (
          <div className={`space-y-1 rounded px-2 py-1.5 ${highlight && item.label === highlight ? "bg-soc-blue/10" : ""}`} key={item.label}>
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-white" title={item.label}>{item.label || "N/A"}</span>
              <span className="shrink-0 font-mono font-bold text-soc-primary">{formatNumber(item.count)} · {getPercent(item.count, total)}%</span>
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

function formatLocation(point?: GeoAnalytics["points"][number]): string {
  if (!point) return "N/A";
  return [point.city, point.country].filter(Boolean).join(", ") || "Ubicación no disponible";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-PE").format(value);
}

function getPercent(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}
