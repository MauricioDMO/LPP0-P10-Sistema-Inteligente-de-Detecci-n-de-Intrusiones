"use client";

import { Bar, Doughnut } from "react-chartjs-2";
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Tooltip,
} from "chart.js";
import type { SuricataEvent } from "@/types/suricata";
import { buildMinuteBuckets, buildTypeCounts } from "@/lib/suricata";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Legend, Tooltip);

type EventChartsProps = {
  events: SuricataEvent[];
};

const chartColors = ["#ef4444", "#4d8eff", "#adc6ff", "#df7412", "#f59e0b", "#4ade80", "#8c909f"];

export function EventCharts({ events }: EventChartsProps) {
  const typeCounts = buildTypeCounts(events);
  const typeLabels = Object.keys(typeCounts);
  const minuteBuckets = buildMinuteBuckets(events);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2" aria-label="Gráficos de eventos">
      <div className="relative overflow-hidden rounded-lg border border-soc-outline/80 bg-soc-low/80 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
        <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-soc-danger/40 via-soc-primary/35 to-transparent" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-soc-muted">Distribución por tipo</h2>
          <span className="font-mono text-xs text-soc-muted">{events.length} eventos</span>
        </div>
        <Doughnut
          data={{
            labels: typeLabels,
            datasets: [{ data: typeLabels.map((label) => typeCounts[label]), backgroundColor: chartColors, borderWidth: 0 }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: true,
            cutout: "64%",
            plugins: { legend: { position: "bottom", labels: { color: "#c2c6d6", font: { size: 11 }, boxWidth: 10, boxHeight: 10 } } },
          }}
        />
      </div>
      <div className="relative overflow-hidden rounded-lg border border-soc-outline/80 bg-soc-low/80 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
        <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-soc-success/35 via-soc-blue/35 to-transparent" />
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-soc-muted">Eventos por minuto</h2>
          <span className="rounded-sm border border-soc-success/25 bg-soc-success/10 px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-green-200">Live</span>
        </div>
        <Bar
          data={{
            labels: minuteBuckets.labels,
            datasets: [{ label: "Eventos", data: minuteBuckets.values, backgroundColor: "#4d8eff", borderRadius: 3 }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: true,
            scales: {
              x: { ticks: { color: "#c2c6d6", font: { size: 10 } }, grid: { display: false } },
              y: { beginAtZero: true, ticks: { color: "#c2c6d6", font: { size: 10 }, precision: 0 }, grid: { color: "rgba(173,198,255,0.08)" } },
            },
            plugins: { legend: { display: false } },
          }}
        />
      </div>
    </div>
  );
}
