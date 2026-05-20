type AnalyticsShellProps = {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
};

export function AnalyticsShell({ title, eyebrow, children, actions }: AnalyticsShellProps) {
  return (
    <section className="relative overflow-hidden rounded-lg border border-soc-outline/80 bg-soc-low/85 p-4 shadow-[0_18px_50px_rgba(0,0,0,0.2)]">
      <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-soc-orange/45 via-soc-primary/35 to-transparent" />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-soc-primary">{eyebrow}</div>
          <h2 className="mt-1 text-base font-bold tracking-[-0.02em] text-white">{title}</h2>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function AnalyticsState({ loading, error, empty }: { loading: boolean; error: string | null; empty?: boolean }) {
  if (loading) return <div className="rounded border border-soc-outline bg-soc-lowest px-4 py-8 text-center text-sm text-soc-muted">Cargando analytics...</div>;
  if (error) return <div className="rounded border border-soc-danger/35 bg-soc-danger/10 px-4 py-8 text-center text-sm text-red-200">{error}</div>;
  if (empty) return <div className="rounded border border-soc-outline bg-soc-lowest px-4 py-8 text-center text-sm text-soc-muted">Sin datos para el rango seleccionado</div>;
  return null;
}
