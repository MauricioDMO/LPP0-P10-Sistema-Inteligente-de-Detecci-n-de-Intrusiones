"use client";

import { IconExternalLink } from "@tabler/icons-react";
import { startTransition, useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchSources, updateSource } from "@/lib/suricata-management-api";
import type { SuricataSource } from "@/types/suricata-management";
import { EmptyState, SectionCard, StatusPill } from "./suricata-ui";

const SOURCE_INFO_URLS: Record<string, string> = {
  "et/open": "https://rules.emergingthreats.net/open/",
  "abuse.ch/urlhaus": "https://urlhaus.abuse.ch/",
  "abuse.ch/feodotracker": "https://feodotracker.abuse.ch/",
  "abuse.ch/sslbl-blacklist": "https://sslbl.abuse.ch/blacklist/",
  "oisf/trafficid": "https://github.com/OISF/suricata-trafficid",
};

const SOURCE_DESCRIPTIONS: Record<string, string> = {
  "et/open": "Ruleset comunitario de Emerging Threats con firmas para malware, exploits, escaneos, botnets, phishing y actividad de red sospechosa. Es una base amplia para detección general en laboratorios y redes pequeñas.",
  "abuse.ch/urlhaus": "Fuente enfocada en URLhaus de abuse.ch para detectar tráfico HTTP/HTTPS asociado a distribución de malware, campañas activas y hosts comprometidos que sirven payloads maliciosos.",
  "abuse.ch/feodotracker": "Indicadores de Feodo Tracker para identificar conexiones hacia infraestructura C2 vinculada a familias como Emotet, Dridex, TrickBot y otros botnets bancarios o loaders.",
  "abuse.ch/sslbl-blacklist": "Lista SSLBL de abuse.ch con certificados, JA3/JA3S e infraestructura TLS relacionada con malware, útil para alertar conexiones cifradas hacia servidores sospechosos.",
  "oisf/trafficid": "Reglas mantenidas por OISF para clasificar aplicaciones y protocolos en el tráfico observado. Ayudan a enriquecer eventos con identificación de servicios, no solo amenazas.",
};

function getSourceDescription(source: SuricataSource) {
  return SOURCE_DESCRIPTIONS[source.source_name] ?? source.description ?? "Sin descripción disponible para esta fuente.";
}

export function SuricataSourcesPage() {
  const [sources, setSources] = useState<SuricataSource[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      setSources(await fetchSources());
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar fuentes");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, []);

  async function handleToggleSource(source: SuricataSource) {
    try {
      const updated = await updateSource(source.id, !source.enabled);
      setSources((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      window.dispatchEvent(new CustomEvent("suricata-config-dirty", { detail: { scope: "sources" } }));
      toast.success("Fuente guardada; ahora puedes ejecutar una actualización completa de rulesets");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la fuente");
    }
  }

  return (
    <SectionCard
      actions={(
        <div className="rounded-xl border border-soc-outline/65 bg-soc-lowest/55 p-4">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-soc-muted">Resumen</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill tone="success">{sources.filter((source) => source.enabled).length} activas</StatusPill>
            <StatusPill tone="muted">{sources.filter((source) => !source.enabled).length} inactivas</StatusPill>
          </div>
        </div>
      )}
      eyebrow="Rulesets"
      title="Fuentes de reglas"
      description="Activa las fuentes externas que quieres incluir. Cambiar una fuente marca pendiente una actualización completa; cambios en reglas locales, listas u overrides pueden aplicarse por la ruta rápida cuando las fuentes no cambiaron."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sources.map((source) => (
          <article className="rounded-xl border border-soc-outline/70 bg-soc-lowest/55 p-4 transition hover:border-soc-primary/35 hover:bg-soc-blue/8" key={source.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-black text-white">{source.display_name}</h3>
                <p className="mt-1 font-mono text-[11px] text-soc-muted">{source.source_name}</p>
              </div>
              <StatusPill tone={source.enabled ? "success" : "muted"}>{source.enabled ? "activa" : "inactiva"}</StatusPill>
            </div>
            <p className="mt-3 min-h-12 text-sm leading-6 text-soc-muted">{getSourceDescription(source)}</p>
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-soc-outline/50 pt-4">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-white">
                <input checked={source.enabled} onChange={() => void handleToggleSource(source)} type="checkbox" />
                {source.enabled ? "Incluir" : "No incluir"}
              </label>
              {SOURCE_INFO_URLS[source.source_name] ? (
                <a className="inline-flex items-center gap-1 rounded-lg border border-soc-outline/70 bg-soc-low px-2.5 py-1.5 text-xs font-bold text-soc-muted transition hover:border-soc-primary/45 hover:text-white" href={SOURCE_INFO_URLS[source.source_name]} rel="noreferrer" target="_blank" title={`Ver información de ${source.display_name}`}>
                  Info <IconExternalLink size={14} />
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
      {!loading && sources.length === 0 ? <EmptyState>No hay fuentes configuradas.</EmptyState> : null}
    </SectionCard>
  );
}
