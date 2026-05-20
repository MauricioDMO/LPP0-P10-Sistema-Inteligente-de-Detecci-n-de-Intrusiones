import type { ConnectionStatus } from "@/types/suricata";

type HeaderProps = {
  totalEvents: number;
  status: ConnectionStatus;
};

const statusText: Record<ConnectionStatus, string> = {
  connected: "● Conectado",
  disconnected: "● Desconectado",
  error: "● Error",
};

const statusClass: Record<ConnectionStatus, string> = {
  connected: "ok",
  disconnected: "err",
  error: "warn",
};

export function Header({ totalEvents, status }: HeaderProps) {
  return (
    <header className="dashboard-header">
      <h1>
        <span aria-hidden="true">[IPS]</span> <strong>Suricata</strong> IPS Monitor
      </h1>
      <div className="header-right">
        <span>{totalEvents} eventos</span>
        <div className={`badge ${statusClass[status]}`}>{statusText[status]}</div>
      </div>
    </header>
  );
}
