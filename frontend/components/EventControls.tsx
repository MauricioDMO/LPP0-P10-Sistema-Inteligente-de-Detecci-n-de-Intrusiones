import type { EventFilterType } from "@/types/suricata";

type EventControlsProps = {
  filterType: EventFilterType;
  filterSeverity: number;
  filterSearch: string;
  onFilterTypeChange: (filter: EventFilterType) => void;
  onSeverityChange: (severity: number) => void;
  onSearchChange: (search: string) => void;
  onExport: () => void;
  onClear: () => void;
};

const filters: Array<{ value: EventFilterType; label: string; className?: string }> = [
  { value: "all", label: "Todos" },
  { value: "alert", label: "Alertas", className: "filter-danger" },
  { value: "blocked", label: "Bloqueos", className: "filter-warning" },
  { value: "dns", label: "DNS" },
  { value: "http", label: "HTTP" },
  { value: "tls", label: "TLS" },
];

export function EventControls({
  filterType,
  filterSeverity,
  filterSearch,
  onFilterTypeChange,
  onSeverityChange,
  onSearchChange,
  onExport,
  onClear,
}: EventControlsProps) {
  return (
    <section className="controls" aria-label="Filtros de eventos">
      {filters.map((filter) => (
        <button
          className={`${filterType === filter.value ? "active" : ""} ${filter.className ?? ""}`}
          key={filter.value}
          onClick={() => onFilterTypeChange(filter.value)}
          type="button"
        >
          {filter.label}
        </button>
      ))}

      <select value={filterSeverity} onChange={(event) => onSeverityChange(Number(event.target.value))} aria-label="Filtrar por severidad">
        <option value={0}>Todas las severidades</option>
        <option value={1}>Crítica (1)</option>
        <option value={2}>Alta (2)</option>
        <option value={3}>Media (3)</option>
        <option value={4}>Baja (4)</option>
      </select>

      <input value={filterSearch} onChange={(event) => onSearchChange(event.target.value)} placeholder="Buscar en eventos..." />
      <button className="export-btn" onClick={onExport} type="button">CSV</button>
      <button className="clear-btn" onClick={onClear} type="button">Limpiar</button>
    </section>
  );
}
