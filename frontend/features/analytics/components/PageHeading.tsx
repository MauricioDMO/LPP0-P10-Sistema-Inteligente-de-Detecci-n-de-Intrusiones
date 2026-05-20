export function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <header className="relative overflow-hidden rounded-lg border border-soc-outline/80 bg-soc-low/90 px-4 py-4 shadow-[0_18px_60px_rgba(0,0,0,0.24)] backdrop-blur md:px-5">
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-soc-primary/60 to-transparent" />
      <div className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-soc-primary">{eyebrow}</div>
      <h1 className="text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">{title}</h1>
      <p className="mt-1 max-w-3xl text-sm text-soc-muted">{description}</p>
    </header>
  );
}
