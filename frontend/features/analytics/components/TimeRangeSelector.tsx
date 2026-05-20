import type { TimeRangeHours } from "@/types/analytics";

type TimeRangeSelectorProps = {
  value: TimeRangeHours;
  onChange: (hours: TimeRangeHours) => void;
};

const ranges: Array<{ value: TimeRangeHours; label: string }> = [
  { value: 1, label: "1h" },
  { value: 6, label: "6h" },
  { value: 24, label: "24h" },
  { value: 168, label: "7d" },
];

export function TimeRangeSelector({ value, onChange }: TimeRangeSelectorProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-soc-outline/80 bg-soc-low/75 p-2" aria-label="Rango histórico">
      <span className="px-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-soc-muted">Rango histórico</span>
      {ranges.map((range) => (
        <button
          className={`rounded border px-3 py-2 font-mono text-[11px] font-black uppercase tracking-[0.12em] transition ${
            value === range.value
              ? "border-soc-primary/65 bg-soc-blue/20 text-white"
              : "border-soc-outline bg-soc-lowest/70 text-soc-muted hover:border-soc-primary/45 hover:text-white"
          }`}
          key={range.value}
          onClick={() => onChange(range.value)}
          type="button"
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}
