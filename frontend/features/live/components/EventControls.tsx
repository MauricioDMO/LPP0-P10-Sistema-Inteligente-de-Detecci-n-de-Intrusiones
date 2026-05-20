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
    <section className="rounded-lg border border-soc-outline/80 bg-soc-low/75 p-3 backdrop-blur" aria-label="Filtros de eventos">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              className={`rounded border px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition hover:-translate-y-0.5 ${
                filterType === filter.value
                  ? "border-soc-primary/70 bg-soc-blue/20 text-white"
                  : "border-soc-outline bg-soc-lowest/70 text-soc-muted hover:border-soc-primary/45 hover:text-white"
              } ${filter.className === "filter-danger" ? "hover:border-soc-danger/70 hover:text-red-200" : ""} ${filter.className === "filter-warning" ? "hover:border-soc-warning/70 hover:text-amber-200" : ""}`}
              key={filter.value}
              onClick={() => onFilterTypeChange(filter.value)}
              type="button"
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center xl:min-w-[620px]">
          <select
            className="rounded border border-soc-outline bg-soc-lowest px-3 py-2 text-sm text-soc-muted outline-none transition focus:border-soc-primary focus:ring-2 focus:ring-soc-primary/15"
            value={filterSeverity}
            onChange={(event) => onSeverityChange(Number(event.target.value))}
            aria-label="Filtrar por severidad"
          >
            <option value={0}>Todas las severidades</option>
            <option value={1}>Crítica (1)</option>
            <option value={2}>Alta (2)</option>
            <option value={3}>Media (3)</option>
            <option value={4}>Baja (4)</option>
          </select>

          <input
            className="min-w-0 flex-1 rounded border border-soc-outline bg-soc-lowest px-3 py-2 text-sm text-white placeholder:text-soc-muted/70 outline-none transition focus:border-soc-primary focus:ring-2 focus:ring-soc-primary/15"
            value={filterSearch}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar IP, hostname, ISP, firma o categoría..."
          />
          <button className="rounded border border-soc-success/45 bg-soc-success/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-green-200 transition hover:bg-soc-success/15" onClick={onExport} type="button">
            Exportar CSV
          </button>
          <button className="rounded border border-soc-danger/35 bg-soc-danger/10 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-red-200 transition hover:bg-soc-danger/15" onClick={onClear} type="button">
            Limpiar
          </button>
        </div>
      </div>
    </section>
  );
}
