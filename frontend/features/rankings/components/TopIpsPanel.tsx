"use client";

import { useState } from "react";
import { AnalyticsShell, AnalyticsState } from "@/features/analytics/components/AnalyticsShell";
import { useAnalytics } from "@/features/analytics/hooks/useAnalytics";
import type { TimeRangeHours, TopIpsResponse } from "@/types/analytics";

type TopIpsPanelProps = {
  hours: TimeRangeHours;
};

export function TopIpsPanel({ hours }: TopIpsPanelProps) {
  const [direction, setDirection] = useState<"source" | "destination">("source");
  const { data, loading, error } = useAnalytics<TopIpsResponse>(`/api/analytics/top-ips?hours=${hours}&direction=${direction}&size=10`);
  const ips = data?.ips ?? [];

  return (
    <AnalyticsShell
      eyebrow="Top IPs"
      title={direction === "source" ? "IPs origen más activas" : "IPs destino más activas"}
      actions={
        <div className="flex rounded border border-soc-outline bg-soc-lowest p-1">
          <button className={toggleClass(direction === "source")} onClick={() => setDirection("source")} type="button">Origen</button>
          <button className={toggleClass(direction === "destination")} onClick={() => setDirection("destination")} type="button">Destino</button>
        </div>
      }
    >
      <AnalyticsState loading={loading} error={error} empty={ips.length === 0} />
      {!loading && !error && ips.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-soc-outline bg-soc-lowest/75 text-[10px] uppercase tracking-[0.12em] text-soc-muted">
                <th className="px-3 py-3">IP</th>
                <th className="px-3 py-3">Eventos</th>
                <th className="px-3 py-3">Severidad máx.</th>
                <th className="px-3 py-3">Último visto</th>
                <th className="px-3 py-3">Firma principal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.045]">
              {ips.map((item) => (
                <tr className="hover:bg-soc-blue/5" key={item.ip}>
                  <td className="px-3 py-3 font-mono text-xs font-bold text-white">{item.ip}</td>
                  <td className="px-3 py-3 font-mono text-soc-primary">{item.count}</td>
                  <td className="px-3 py-3 text-soc-muted">{item.max_severity ?? "-"}</td>
                  <td className="px-3 py-3 text-xs text-soc-muted">{formatDate(item.last_seen)}</td>
                  <td className="max-w-[340px] truncate px-3 py-3 text-xs text-soc-muted" title={item.top_signatures?.[0]?.signature}>{item.top_signatures?.[0]?.signature ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </AnalyticsShell>
  );
}

function toggleClass(active: boolean): string {
  return `rounded px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] transition ${active ? "bg-soc-blue/25 text-white" : "text-soc-muted hover:text-white"}`;
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("es-PE");
}
