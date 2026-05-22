"use client";

import { Line } from "react-chartjs-2";
import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";
import { AnalyticsShell, AnalyticsState } from "@/features/analytics/components/AnalyticsShell";
import { useAnalytics } from "@/features/analytics/hooks/useAnalytics";
import type { AnalyticsTimeline, TimeRangeHours } from "@/types/analytics";

ChartJS.register(CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip);

type HistoricalTimelineProps = {
  hours: TimeRangeHours;
};

export function HistoricalTimeline({ hours }: HistoricalTimelineProps) {
  const interval = hours <= 1 ? "5m" : hours <= 24 ? "30m" : "6h";
  const { data, loading, error } = useAnalytics<AnalyticsTimeline>(`/api/analytics/timeline?hours=${hours}&interval=${interval}`);
  const points = data?.points ?? [];

  return (
    <AnalyticsShell eyebrow="Tendencia" title="Tendencia histórica">
      <AnalyticsState loading={loading} error={error} empty={points.length === 0} />
      {!loading && !error && points.length > 0 ? (
        <div className="relative h-75">
          <Line
            data={{
              labels: points.map((point) => formatTimelineLabel(point.timestamp, hours)),
              datasets: [
                { label: "Total", data: points.map((point) => point.total), borderColor: "#4d8eff", backgroundColor: "rgba(77,142,255,0.16)", fill: true, tension: 0.32, pointRadius: 0 },
                { label: "Alertas", data: points.map((point) => point.alerts), borderColor: "#ef4444", backgroundColor: "rgba(239,68,68,0.08)", tension: 0.32, pointRadius: 0 },
                { label: "Bloqueos", data: points.map((point) => point.blocked), borderColor: "#f59e0b", backgroundColor: "rgba(245,158,11,0.08)", tension: 0.32, pointRadius: 0 },
                { label: "Críticas", data: points.map((point) => point.critical), borderColor: "#ffb4ab", backgroundColor: "rgba(255,180,171,0.08)", tension: 0.32, pointRadius: 0 },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              scales: {
                x: { ticks: { color: "#c2c6d6", font: { size: 10 }, maxTicksLimit: 8 }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: "#c2c6d6", font: { size: 10 }, precision: 0 }, grid: { color: "rgba(173,198,255,0.08)" } },
              },
              plugins: { legend: { position: "bottom", labels: { color: "#c2c6d6", font: { size: 11 }, boxWidth: 10, boxHeight: 10 } } },
            }}
          />
        </div>
      ) : null}
    </AnalyticsShell>
  );
}

function formatTimelineLabel(timestamp: string, hours: TimeRangeHours): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "";
  return hours >= 168
    ? date.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit" })
    : date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}
