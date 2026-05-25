import type { RuleOverride, SuricataProfile } from "@/types/suricata-management";

export const ACTIONS: RuleOverride["action"][] = ["enable", "disable", "drop", "reject", "alert"];

export const ACTION_LABELS: Record<RuleOverride["action"], string> = {
  enable: "Activar regla",
  disable: "Desactivar regla",
  drop: "Bloquear sin respuesta",
  reject: "Bloquear con rechazo",
  alert: "Solo alertar",
};

export const ACTION_HELP: Record<RuleOverride["action"], string> = {
  enable: "Fuerza que una regla por SID quede activa aunque la fuente la traiga deshabilitada.",
  disable: "Evita que una regla por SID se cargue, útil para falsos positivos.",
  drop: "Convierte la regla a bloqueo IPS silencioso cuando Suricata corre en modo IPS.",
  reject: "Convierte la regla a bloqueo IPS enviando rechazo TCP/ICMP cuando aplica.",
  alert: "Mantiene la regla como detección sin bloqueo activo.",
};

export const ACTION_TONE: Record<RuleOverride["action"], "success" | "danger" | "warning" | "primary" | "muted"> = {
  enable: "success",
  disable: "muted",
  drop: "danger",
  reject: "warning",
  alert: "primary",
};

const toneClasses = {
  danger: "border-soc-danger/40 bg-soc-danger/10 text-red-200",
  muted: "border-soc-outline/70 bg-soc-lowest text-soc-muted",
  primary: "border-soc-primary/45 bg-soc-primary/10 text-soc-primary",
  success: "border-soc-success/40 bg-soc-success/10 text-green-200",
  warning: "border-soc-warning/45 bg-soc-warning/10 text-yellow-100",
};

export function SectionCard({ actions, children, description, eyebrow, title }: { actions?: React.ReactNode; children: React.ReactNode; description?: string; eyebrow?: string; title: string }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-soc-outline/75 bg-soc-low/85 shadow-[0_22px_70px_rgba(0,0,0,0.24)] backdrop-blur">
      <div className="flex flex-col gap-4 border-b border-soc-outline/55 bg-soc-lowest/35 px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div>
          {eyebrow ? <div className="mb-1 font-mono text-[10px] font-black uppercase tracking-[0.18em] text-soc-primary">{eyebrow}</div> : null}
          <h2 className="text-lg font-black tracking-[-0.02em] text-white">{title}</h2>
          {description ? <p className="mt-1 max-w-4xl text-sm leading-6 text-soc-muted">{description}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function FormPanel({ children, title, description }: { children: React.ReactNode; description?: string; title?: string }) {
  return (
    <div className="rounded-xl border border-soc-outline/65 bg-soc-lowest/55 p-4 shadow-inner shadow-black/10 sm:p-5">
      {title ? (
        <div className="mb-3">
          <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white">{title}</h3>
          {description ? <p className="mt-1 text-xs leading-5 text-soc-muted">{description}</p> : null}
        </div>
      ) : null}
      <div className="grid gap-4">{children}</div>
    </div>
  );
}

export function InfoPanel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <aside className="rounded-xl border border-soc-primary/25 bg-soc-primary/8 p-4 sm:p-5">
      <h3 className="text-xs font-black uppercase tracking-[0.14em] text-soc-primary">{title}</h3>
      <div className="mt-2 text-sm leading-6 text-soc-muted">{children}</div>
    </aside>
  );
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1 block text-xs font-bold uppercase tracking-[0.1em] text-soc-muted">{children}</span>;
}

export const inputClassName = "w-full rounded-lg border border-soc-outline/80 bg-soc-lowest px-3 py-2 text-sm text-white outline-none transition placeholder:text-soc-muted/55 focus:border-soc-primary/75 focus:ring-2 focus:ring-soc-primary/10";

export const selectClassName = inputClassName;

export const textareaClassName = "min-h-36 w-full rounded-lg border border-soc-outline/80 bg-soc-lowest px-3 py-2 font-mono text-xs leading-5 text-white outline-none transition placeholder:text-soc-muted/55 focus:border-soc-primary/75 focus:ring-2 focus:ring-soc-primary/10";

export function ActionButton({ children, disabled, onClick, tone = "primary", type = "button" }: { children: React.ReactNode; disabled?: boolean; onClick?: () => void; tone?: "danger" | "ghost" | "primary"; type?: "button" | "submit" }) {
  const className = tone === "danger"
    ? "border-soc-danger/45 bg-soc-danger/10 text-red-100 hover:bg-soc-danger/18"
    : tone === "ghost"
      ? "border-soc-outline/75 bg-soc-low text-soc-muted hover:border-soc-primary/45 hover:text-white"
      : "border-soc-primary/45 bg-soc-blue/25 text-white hover:bg-soc-blue/35";

  return (
    <button className={`inline-flex items-center justify-center gap-2 rounded-lg border px-3.5 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${className}`} disabled={disabled} onClick={onClick} type={type}>
      {children}
    </button>
  );
}

export function StatusPill({ children, tone = "muted" }: { children: React.ReactNode; tone?: keyof typeof toneClasses }) {
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${toneClasses[tone]}`}>{children}</span>;
}

export function MetricCard({ description, label, tone = "muted", value }: { description?: string; label: string; tone?: keyof typeof toneClasses; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-soc-outline/70 bg-soc-low/80 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-[0.14em] text-soc-muted">{label}</div>
        <span className={`h-2.5 w-2.5 rounded-full border ${toneClasses[tone]}`} />
      </div>
      <div className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">{value}</div>
      {description ? <p className="mt-1 text-sm leading-5 text-soc-muted">{description}</p> : null}
    </div>
  );
}

export function ProfileSelect({ onChange, profiles, value }: { onChange: (profileId: string) => void; profiles: SuricataProfile[]; value: string }) {
  return (
    <label className="block">
      <FieldLabel>Perfil de trabajo</FieldLabel>
      <select className={selectClassName} onChange={(event) => onChange(event.target.value)} value={value}>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.name} {profile.is_active ? "(activo)" : ""}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-soc-outline/60 bg-soc-lowest/35 px-5 py-10 text-center text-sm text-soc-muted">{children}</div>;
}

export function ResponsiveTable({ children }: { children: React.ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-soc-outline/70 bg-soc-lowest/55">{children}</div>;
}

export function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
}

export function statusClass(status: string) {
  if (status === "success" || status === "valid") return "border-soc-success/40 bg-soc-success/10 text-green-200";
  if (status === "failed" || status === "invalid") return "border-soc-danger/40 bg-soc-danger/10 text-red-200";
  return "border-soc-warning/40 bg-soc-warning/10 text-yellow-100";
}
