import type { DashboardStats } from "@/types/suricata";

type StatsBarProps = {
  stats: DashboardStats;
};

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <section className="stats-bar" aria-label="Resumen de eventos">
      <StatCard label="Total" value={stats.total} />
      <StatCard label="Alertas" value={stats.alerts} tone="danger" />
      <StatCard label="Maliciosas" value={stats.malicious} tone="malicious" />
      <StatCard label="Bloqueos" value={stats.blocked} tone="warning" />
      <StatCard label="DNS" value={stats.dns} />
      <StatCard label="IPs únicas" value={stats.uniqueIps} />
    </section>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "danger" | "malicious" | "warning" }) {
  return (
    <div className="stat-card">
      <div className={`num ${tone ? `num-${tone}` : ""}`}>{value}</div>
      <div className="label">{label}</div>
    </div>
  );
}
