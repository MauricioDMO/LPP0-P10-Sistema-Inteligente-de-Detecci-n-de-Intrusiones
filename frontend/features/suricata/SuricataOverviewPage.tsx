"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { fetchSuricataStatus } from "@/lib/suricata-management-api";
import type { SuricataStatus } from "@/types/suricata-management";
import { ACTIONS, ACTION_HELP, ACTION_LABELS, ACTION_TONE, formatDate, MetricCard, SectionCard, StatusPill, statusClass } from "./suricata-ui";

const workflow = [
  { href: "/suricata/profiles", label: "1. Perfil", text: "Define si Suricata detecta solamente o también bloquea tráfico." },
  { href: "/suricata/sources", label: "2. Fuentes", text: "Elige rulesets externos para alimentar suricata-update." },
  { href: "/suricata/custom-rules", label: "3. Reglas", text: "Agrega reglas locales u overrides por SID para casos específicos." },
  { href: "/suricata", label: "4. Aplicar", text: "Recarga Suricata cuando termines de preparar los cambios." },
];

export function SuricataOverviewPage() {
  const [status, setStatus] = useState<SuricataStatus | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setStatus(await fetchSuricataStatus());
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "No se pudo cargar estado Suricata");
      }
    }

    void load();
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-3 lg:grid-cols-3">
        <MetricCard label="Estado Suricata" value={status?.container_running ? "En línea" : "Fuera de línea"} tone={status?.container_running ? "success" : "danger"} description="Contenedor Docker: suricata" />
        <MetricCard label="Perfil activo" value={status?.active_profile?.name ?? "Sin perfil"} tone={status?.active_profile ? "primary" : "warning"} description={status?.active_profile ? `${status.active_profile.mode} / sensibilidad ${status.active_profile.sensitivity}` : "Activa un perfil antes de aplicar reglas."} />
        <MetricCard label="Última aplicación" value={status?.last_job?.status ?? "Sin jobs"} tone={status?.last_job?.status === "success" ? "success" : status?.last_job?.status === "failed" ? "danger" : "muted"} description={formatDate(status?.last_job?.created_at ?? null)} />
      </section>
      {status?.last_job?.error_message ? <div className={`rounded-xl border p-3 text-sm ${statusClass("failed")}`}>{status.last_job.error_message}</div> : null}

      <SectionCard eyebrow="Guía rápida" title="Flujo recomendado" description="Trabaja una sección a la vez para evitar mezclar cambios de distinta naturaleza.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {workflow.map((item) => (
            <Link className="group rounded-xl border border-soc-outline/70 bg-soc-lowest/60 p-3 transition hover:-translate-y-0.5 hover:border-soc-primary/45 hover:bg-soc-blue/10" href={item.href} key={item.label}>
              <h3 className="text-sm font-black text-white group-hover:text-soc-primary">{item.label}</h3>
              <p className="mt-1 text-sm leading-6 text-soc-muted">{item.text}</p>
            </Link>
          ))}
        </div>
      </SectionCard>

      <SectionCard eyebrow="Referencia" title="Acciones de override" description="Referencia rápida para decidir qué comportamiento asignar a un SID.">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {ACTIONS.map((action) => (
            <div className="rounded-xl border border-soc-outline/70 bg-soc-lowest/60 p-3" key={action}>
              <StatusPill tone={ACTION_TONE[action]}>{action}</StatusPill>
              <h3 className="mt-3 text-sm font-bold text-white">{ACTION_LABELS[action]}</h3>
              <p className="mt-1 text-sm text-soc-muted">{ACTION_HELP[action]}</p>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}
