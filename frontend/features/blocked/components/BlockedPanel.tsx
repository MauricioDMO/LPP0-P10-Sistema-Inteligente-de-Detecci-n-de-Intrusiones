"use client";

import { AnalyticsShell, AnalyticsState } from "@/features/analytics/components/AnalyticsShell";
import { useAnalytics } from "@/features/analytics/hooks/useAnalytics";
import type { BlockedAnalytics, TimeRangeHours } from "@/types/analytics";

type BlockedPanelProps = {
  hours: TimeRangeHours;
};

export function BlockedPanel({ hours }: BlockedPanelProps) {
  const { data, loading, error } = useAnalytics<BlockedAnalytics>(`/api/analytics/blocked?hours=${hours}&size=10`);
  const hasData = Boolean(data && (data.total_blocked > 0 || data.top_signatures.length > 0));

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[0.8fr_1.2fr]">
      <AnalyticsShell eyebrow="IPS" title="Evidencia de bloqueos">
        <AnalyticsState loading={loading} error={error} empty={!hasData} />
        {!loading && !error && data ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-soc-warning/40 bg-soc-warning/10 p-5">
              <div className="font-mono text-5xl font-black leading-none tracking-[-0.06em] text-amber-200">{data.total_blocked}</div>
              <div className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-soc-muted">Bloqueos confirmados</div>
            </div>
            <RankList title="Tipos de evento" items={data.by_type.map((item) => ({ label: item.type, count: item.count }))} />
          </div>
        ) : null}
      </AnalyticsShell>
      <AnalyticsShell eyebrow="Reglas e IPs" title="Qué se bloqueó y quién estuvo involucrado">
        <AnalyticsState loading={loading} error={error} empty={!hasData} />
        {!loading && !error && data ? (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <RankList title="Reglas" items={data.top_signatures.map((item) => ({ label: item.signature, count: item.count }))} highlightBlocked />
            <RankList title="Origen" items={data.top_source_ips.map((item) => ({ label: item.ip, count: item.count }))} mono />
            <RankList title="Destino" items={data.top_destination_ips.map((item) => ({ label: item.ip, count: item.count }))} mono />
          </div>
        ) : null}
      </AnalyticsShell>
    </div>
  );
}

function RankList({ title, items, mono, highlightBlocked }: { title: string; items: Array<{ label: string; count: number }>; mono?: boolean; highlightBlocked?: boolean }) {
  return (
    <div className="rounded-lg border border-soc-outline bg-soc-lowest/65 p-3">
      <h3 className="mb-3 text-[10px] font-black uppercase tracking-[0.14em] text-soc-muted">{title}</h3>
      <div className="space-y-2">
        {items.length === 0 ? <div className="text-xs text-soc-muted">Sin datos</div> : null}
        {items.map((item) => {
          const blocked = highlightBlocked && item.label.toLowerCase().includes("bloqueo");
          return (
            <div className="flex items-center justify-between gap-3 rounded border border-white/5 bg-soc-low/70 px-2 py-2" key={item.label}>
              <span className={`min-w-0 truncate text-xs ${mono ? "font-mono" : ""} ${blocked ? "text-amber-200" : "text-white"}`} title={item.label}>{item.label}</span>
              <span className="shrink-0 rounded bg-soc-blue/15 px-2 py-1 font-mono text-[11px] font-bold text-soc-primary">{item.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
