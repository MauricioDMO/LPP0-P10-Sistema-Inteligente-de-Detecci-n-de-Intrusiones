"use client";

import { AnalyticsShell, AnalyticsState } from "@/features/analytics/components/AnalyticsShell";
import { useAnalytics } from "@/features/analytics/hooks/useAnalytics";
import type { TimeRangeHours, TopSignaturesResponse } from "@/types/analytics";

type TopSignaturesProps = {
  hours: TimeRangeHours;
};

export function TopSignatures({ hours }: TopSignaturesProps) {
  const { data, loading, error } = useAnalytics<TopSignaturesResponse>(`/api/analytics/top-signatures?hours=${hours}&size=10`);
  const signatures = data?.signatures ?? [];

  return (
    <AnalyticsShell eyebrow="Reglas Suricata" title="Firmas más frecuentes">
      <AnalyticsState loading={loading} error={error} empty={signatures.length === 0} />
      {!loading && !error && signatures.length > 0 ? (
        <div className="space-y-2">
          {signatures.map((item) => {
            const blocked = item.signature.toLowerCase().includes("bloqueo");
            const category = item.categories?.[0]?.category;

            return (
              <div className={`rounded-lg border p-3 ${blocked ? "border-soc-warning/45 bg-soc-warning/10" : "border-soc-outline bg-soc-lowest/65"}`} key={item.signature}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-white" title={item.signature}>{item.signature}</div>
                    <div className="mt-1 text-xs text-soc-muted">{category ?? "Sin categoría"} · Último: {formatDate(item.last_seen)}</div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {blocked ? <span className="rounded border border-soc-warning/45 bg-soc-warning/10 px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-amber-200">Bloqueo</span> : null}
                    <span className="rounded border border-soc-primary/35 bg-soc-blue/10 px-2 py-1 font-mono text-xs font-bold text-soc-primary">{item.count}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </AnalyticsShell>
  );
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-PE");
}
