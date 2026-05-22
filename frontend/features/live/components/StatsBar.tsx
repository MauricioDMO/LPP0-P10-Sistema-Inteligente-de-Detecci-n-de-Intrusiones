import type { DashboardStats } from "@/types/suricata";

type StatsBarProps = {
  stats: DashboardStats;
};

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-label="Resumen de eventos">
      <StatCard label="Total eventos" value={stats.total} accent="bg-soc-primary" />
      <StatCard label="Críticos" value={stats.critical} accent="bg-soc-danger" valueClass="text-red-200" glow="shadow-[0_0_18px_rgba(239,68,68,0.16)]" />
      <StatCard label="Alertas" value={stats.alerts} accent="bg-soc-danger" valueClass="text-soc-danger" />
      <StatCard label="Bloqueos" value={stats.blocked} accent="bg-soc-warning" valueClass="text-amber-200" />
      <StatCard label="IPs maliciosas" value={stats.malicious} accent="bg-red-500" valueClass="text-red-300" />
      <StatCard label="IPs únicas" value={stats.uniqueIps} accent="bg-soc-blue" />
    </section>
  );
}

function StatCard({
  label,
  value,
  accent,
  valueClass = "text-white",
  glow = "",
}: {
  label: string;
  value: number;
  accent: string;
  valueClass?: string;
  glow?: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-lg border border-soc-outline/80 bg-soc-low/80 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${glow}`}>
      <div className={`mb-3 h-1 w-8 rounded-full ${accent}`} />
      <div className={`font-mono text-3xl font-bold leading-none tracking-[-0.04em] ${valueClass}`}>{value}</div>
      <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-soc-muted">{label}</div>
    </div>
  );
}
