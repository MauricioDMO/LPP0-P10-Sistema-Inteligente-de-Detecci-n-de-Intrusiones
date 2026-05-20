import type { ConnectionStatus } from "@/types/suricata";

type HeaderProps = {
  totalEvents: number;
  eventLimit: number;
  status: ConnectionStatus;
};

const statusText: Record<ConnectionStatus, string> = {
  connected: "Feed en vivo",
  disconnected: "Reconectando",
  error: "Error de enlace",
};

const statusClass: Record<ConnectionStatus, string> = {
  connected: "border-soc-success/35 bg-soc-success/10 text-soc-success shadow-[0_0_20px_rgba(74,222,128,0.12)]",
  disconnected: "border-soc-danger/35 bg-soc-danger/10 text-red-200",
  error: "border-soc-warning/40 bg-soc-warning/10 text-amber-200",
};

export function Header({ totalEvents, eventLimit, status }: HeaderProps) {
  return (
    <header className="relative overflow-hidden rounded-lg border border-soc-outline/80 bg-soc-low/90 px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.34)] backdrop-blur md:px-5">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-soc-primary/60 to-transparent" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-soc-primary">
            <span className="rounded-sm border border-soc-primary/25 bg-soc-blue/10 px-2 py-1">IPS / IDS</span>
            <span className="text-soc-muted">Suricata EVE stream</span>
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">
            Suricata Threat Operations
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-soc-muted">
            Monitoreo enriquecido con DNS inverso, geolocalización, AbuseIPDB y alertas críticas en tiempo real.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
          <span className="rounded border border-soc-outline bg-soc-lowest px-3 py-2 text-soc-muted">
            BUFFER <strong className="text-white">{totalEvents}</strong>/{eventLimit}
          </span>
          <div className={`inline-flex items-center gap-2 rounded border px-3 py-2 font-bold uppercase tracking-[0.08em] ${statusClass[status]}`}>
            <span className={`h-2 w-2 rounded-full ${status === "connected" ? "animate-pulse bg-soc-success" : status === "error" ? "bg-soc-warning" : "bg-soc-danger"}`} />
            {statusText[status]}
          </div>
        </div>
      </div>
    </header>
  );
}
