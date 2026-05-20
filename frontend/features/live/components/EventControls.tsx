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
    <section className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]" aria-label="Controles de eventos">
      <div className="rounded-lg border border-soc-outline/80 bg-soc-low/75 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur" aria-label="Filtros de la tabla">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-mono text-[11px] font-black uppercase tracking-[0.16em] text-soc-primary">Filtro de tabla</h2>
          <span className="hidden h-px flex-1 bg-soc-outline/60 sm:block" />
        </div>

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Tipo de evento">
            {filters.map((filter) => (
              <button
                className={`rounded-md border px-3 py-2 text-xs font-bold uppercase tracking-[0.08em] transition hover:-translate-y-0.5 ${
                  filterType === filter.value
                    ? "border-soc-primary/70 bg-soc-blue/20 text-white shadow-[0_0_18px_rgba(77,142,255,0.12)]"
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

          <label className="grid gap-1.5">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-soc-muted">Severidad</span>
            <select
              className="h-10 rounded-md border border-soc-outline bg-soc-lowest px-3 text-sm text-white outline-none transition focus:border-soc-primary focus:ring-2 focus:ring-soc-primary/15"
              value={filterSeverity}
              onChange={(event) => onSeverityChange(Number(event.target.value))}
              aria-label="Filtrar por severidad"
            >
              <option value={0}>Todas</option>
              <option value={1}>Crítica (1)</option>
              <option value={2}>Alta (2)</option>
              <option value={3}>Media (3)</option>
              <option value={4}>Baja (4)</option>
            </select>
          </label>

          <label className="grid gap-1.5 xl:col-span-2">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-soc-muted">Buscar</span>
            <input
              className="h-10 min-w-0 rounded-md border border-soc-outline bg-soc-lowest px-3 text-sm text-white placeholder:text-soc-muted/70 outline-none transition focus:border-soc-primary focus:ring-2 focus:ring-soc-primary/15"
              value={filterSearch}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="IP, hostname, ISP, firma o categoría"
              aria-label="Buscar en la tabla de eventos"
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-soc-outline/80 bg-soc-low/75 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur" aria-label="Opciones del flujo en vivo">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-mono text-[11px] font-black uppercase tracking-[0.16em] text-soc-primary">Flujo en vivo</h2>
          <span className="hidden h-px flex-1 bg-soc-outline/60 sm:block" />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="font-mono max-w-full text-[10px] font-bold uppercase tracking-[0.14em] text-soc-muted">Registros</span>
            <input
              aria-label="Número máximo de registros"
              className="h-10 max-w-full w-full rounded-md border border-soc-outline bg-soc-lowest px-3 font-mono text-sm text-white outline-none transition [appearance:textfield] focus:border-soc-primary focus:ring-2 focus:ring-soc-primary/15 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              min={1}
              onChange={(event) => setEventLimitInput(event.target.value)}
              onKeyDown={handleRuntimeInputKeyDown}
              type="number"
              value={eventLimitInput}
            />
          </label>

          <label className="grid gap-1.5">
            <span className="font-mono max-w-full text-[10px] font-bold uppercase tracking-[0.14em] text-soc-muted">Actualización (s)</span>
            <input
              aria-label="Tasa de refresco de la interfaz en segundos"
              className="h-10 max-w-full w-full rounded-md border border-soc-outline bg-soc-lowest px-3 font-mono text-sm text-white outline-none transition [appearance:textfield] focus:border-soc-primary focus:ring-2 focus:ring-soc-primary/15 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              min={0}
              onChange={(event) => setRefreshInput(event.target.value)}
              onKeyDown={handleRuntimeInputKeyDown}
              step="0.5"
              type="number"
              value={refreshInput}
            />
          </label>

          <button className="h-10 rounded-md border border-soc-primary/45 bg-soc-blue/15 px-3 text-xs font-bold uppercase tracking-widest text-soc-primary transition hover:border-soc-primary/70 hover:bg-soc-blue/20 hover:text-white sm:col-span-2 lg:col-span-1 xl:col-span-2" onClick={applyRuntimeOptions} type="button">
            Actualizar flujo
          </button>

          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2 lg:col-span-1 xl:col-span-2">
            <button className="h-10 rounded-md border border-soc-success/45 bg-soc-success/10 px-3 text-xs font-bold uppercase tracking-widest text-green-200 transition hover:bg-soc-success/15" onClick={onExport} type="button">
              Exportar CSV
            </button>
            <button className="h-10 rounded-md border border-soc-danger/35 bg-soc-danger/10 px-3 text-xs font-bold uppercase tracking-widest text-red-200 transition hover:bg-soc-danger/15" onClick={onClear} type="button">
              Limpiar
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
