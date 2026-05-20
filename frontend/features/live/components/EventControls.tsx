import { useState } from "react";
import { toast } from "sonner";
import type { EventFilterType } from "@/types/suricata";

type EventControlsProps = {
  filterType: EventFilterType;
  filterSeverity: number;
  filterSearch: string;
  eventLimit: number;
  refreshMs: number;
  onFilterTypeChange: (filter: EventFilterType) => void;
  onSeverityChange: (severity: number) => void;
  onSearchChange: (search: string) => void;
  onEventLimitChange: (limit: number) => void;
  onRefreshMsChange: (refreshMs: number) => void;
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
  eventLimit,
  refreshMs,
  onFilterTypeChange,
  onSeverityChange,
  onSearchChange,
  onEventLimitChange,
  onRefreshMsChange,
  onExport,
  onClear,
}: EventControlsProps) {
  const [eventLimitInput, setEventLimitInput] = useState(String(eventLimit));
  const [refreshInput, setRefreshInput] = useState(String(refreshMs / 1000));

  function applyRuntimeOptions() {
    const nextEventLimit = Math.max(1, Math.floor(Number(eventLimitInput)) || eventLimit);
    const nextRefreshSeconds = Math.max(0, Number(refreshInput));
    const nextRefreshMs = Number.isFinite(nextRefreshSeconds) ? Math.round(nextRefreshSeconds * 1000) : refreshMs;

    setEventLimitInput(String(nextEventLimit));
    setRefreshInput(String(nextRefreshMs / 1000));
    onEventLimitChange(nextEventLimit);
    onRefreshMsChange(nextRefreshMs);
    toast.success("Opciones actualizadas", {
      description: `Registros: ${nextEventLimit} · Refresco: ${nextRefreshMs === 0 ? "instantáneo" : `${nextRefreshMs / 1000}s`}`,
    });
  }

  function handleRuntimeInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") applyRuntimeOptions();
  }

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

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:max-w-[980px] xl:justify-end">
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

          <label className="flex items-center gap-2 rounded border border-soc-outline bg-soc-lowest px-3 py-2 text-xs text-soc-muted transition focus-within:border-soc-primary focus-within:ring-2 focus-within:ring-soc-primary/15">
            Registros
            <input
              aria-label="Número máximo de registros"
              className="w-20 bg-transparent font-mono text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              min={1}
              onChange={(event) => setEventLimitInput(event.target.value)}
              onKeyDown={handleRuntimeInputKeyDown}
              type="number"
              value={eventLimitInput}
            />
          </label>

          <label className="flex items-center gap-2 rounded border border-soc-outline bg-soc-lowest px-3 py-2 text-xs text-soc-muted transition focus-within:border-soc-primary focus-within:ring-2 focus-within:ring-soc-primary/15">
            Refresco (s)
            <input
              aria-label="Tasa de refresco de la interfaz en segundos"
              className="w-16 bg-transparent font-mono text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              min={0}
              onChange={(event) => setRefreshInput(event.target.value)}
              onKeyDown={handleRuntimeInputKeyDown}
              step="0.5"
              type="number"
              value={refreshInput}
            />
          </label>

          <button className="rounded border border-soc-primary/45 bg-soc-blue/15 px-3 py-2 text-xs font-bold uppercase tracking-[0.1em] text-soc-primary transition hover:border-soc-primary/70 hover:bg-soc-blue/20 hover:text-white" onClick={applyRuntimeOptions} type="button">
            Aplicar
          </button>

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
