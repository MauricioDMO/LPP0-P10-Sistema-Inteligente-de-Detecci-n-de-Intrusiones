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

const chartColors = ["#ff6b6b", "#4dd4ac", "#4d94ff", "#b279ff", "#ffc107", "#ff9900", "#8892a8"];

export function EventCharts({ events }: EventChartsProps) {
  const typeCounts = buildTypeCounts(events);
  const typeLabels = Object.keys(typeCounts);
  const minuteBuckets = buildMinuteBuckets(events);

  return (
    <section className="main-grid" aria-label="Gráficos de eventos">
      <div className="chart-box">
        <h3>Tipos de evento</h3>
        <Doughnut
          data={{
            labels: typeLabels,
            datasets: [{ data: typeLabels.map((label) => typeCounts[label]), backgroundColor: chartColors, borderWidth: 0 }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: true,
            plugins: { legend: { position: "bottom", labels: { color: "#8892a8", font: { size: 11 } } } },
          }}
        />
      </div>
      <div className="chart-box">
        <h3>Eventos por minuto</h3>
        <Bar
          data={{
            labels: minuteBuckets.labels,
            datasets: [{ label: "Eventos", data: minuteBuckets.values, backgroundColor: "#4dd4ac", borderRadius: 4 }],
          }}
          options={{
            responsive: true,
            maintainAspectRatio: true,
            scales: {
              x: { ticks: { color: "#8892a8", font: { size: 10 } }, grid: { display: false } },
              y: { beginAtZero: true, ticks: { color: "#8892a8", font: { size: 10 } }, grid: { color: "rgba(255,255,255,0.04)" } },
            },
            plugins: { legend: { display: false } },
          }}
        />
      </div>
    </section>
  );
}
