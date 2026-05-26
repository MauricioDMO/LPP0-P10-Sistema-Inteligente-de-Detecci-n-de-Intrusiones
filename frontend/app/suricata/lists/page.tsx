"use client";

import { IconEye, IconTrash } from "@tabler/icons-react";
import { FormEvent, startTransition, useEffect, useState } from "react";
import { toast } from "sonner";
import { ActionButton, EmptyState, FieldLabel, FormPanel, inputClassName, ProfileSelect, SectionCard, selectClassName, StatusPill } from "@/features/suricata/suricata-ui";
import { createListEntry, deleteListEntry, fetchGeneratedRules, fetchListEntries, updateListEntry } from "@/lib/lists-api";
import { fetchProfiles, fetchSuricataStatus } from "@/lib/suricata-management-api";
import type { GeneratedRule, ListAction, ListDirection, ListEntry, ListEntryType, ListType } from "@/types/lists";
import type { SuricataProfile } from "@/types/suricata-management";

const typeLabels: Record<ListType, string> = { block: "Lista negra", allow: "Lista blanca" };
const directionLabels: Record<ListDirection, string> = { destination: "Destino", source: "Origen", both: "Ambos" };

export default function ListsPage() {
  const [profiles, setProfiles] = useState<SuricataProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [activeList, setActiveList] = useState<ListType>("block");
  const [entries, setEntries] = useState<ListEntry[]>([]);
  const [generatedRules, setGeneratedRules] = useState<GeneratedRule[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{ entry_type: ListEntryType; value: string; direction: ListDirection; action: ListAction; reason: string; enabled: boolean; notify_enabled: boolean }>({
    entry_type: "domain",
    value: "",
    direction: "destination",
    action: "drop",
    reason: "",
    enabled: true,
    notify_enabled: false,
  });

  async function loadProfile(profileId: string, listType = activeList) {
    if (!profileId) {
      setEntries([]);
      setGeneratedRules([]);
      return;
    }
    const [nextEntries, rulesResponse] = await Promise.all([fetchListEntries(listType, profileId), fetchGeneratedRules(profileId)]);
    setEntries(nextEntries);
    setGeneratedRules(rulesResponse.rules);
  }

  useEffect(() => {
    startTransition(() => {
      async function loadInitial() {
        try {
          const [status, nextProfiles] = await Promise.all([fetchSuricataStatus(), fetchProfiles()]);
          const nextProfileId = status.active_profile?.id || nextProfiles[0]?.id || "";
          setProfiles(nextProfiles);
          setSelectedProfileId(nextProfileId);
          if (nextProfileId) {
            const [nextEntries, rulesResponse] = await Promise.all([fetchListEntries("block", nextProfileId), fetchGeneratedRules(nextProfileId)]);
            setEntries(nextEntries);
            setGeneratedRules(rulesResponse.rules);
          }
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "No se pudieron cargar las listas");
        }
      }
      void loadInitial();
    });
  }, []);

  async function handleSelectProfile(profileId: string) {
    setSelectedProfileId(profileId);
    try {
      await loadProfile(profileId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el perfil");
    }
  }

  async function handleSelectList(listType: ListType) {
    setActiveList(listType);
    setForm((current) => ({ ...current, action: listType === "allow" ? "pass" : current.action === "pass" ? "drop" : current.action }));
    try {
      await loadProfile(selectedProfileId, listType);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar la lista");
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfileId) return;
    setSaving(true);
    try {
      await createListEntry(activeList, {
        profile_id: selectedProfileId,
        entry_type: form.entry_type,
        value: form.value,
        direction: form.direction,
        action: activeList === "allow" ? "pass" : form.action,
        reason: form.reason || null,
        enabled: form.enabled,
        notify_enabled: activeList === "block" ? form.notify_enabled : false,
      });
      setForm((current) => ({ ...current, value: "", reason: "" }));
      await loadProfile(selectedProfileId);
      window.dispatchEvent(new Event("suricata-config-dirty"));
      toast.success("Entrada guardada; aplica cambios para recargar Suricata");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo agregar la entrada");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(entry: ListEntry) {
    try {
      await updateListEntry(entry.list_type, entry.id, { enabled: !entry.enabled });
      await loadProfile(selectedProfileId);
      window.dispatchEvent(new Event("suricata-config-dirty"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la entrada");
    }
  }

  async function handleToggleNotification(entry: ListEntry) {
    try {
      await updateListEntry(entry.list_type, entry.id, { notify_enabled: !entry.notify_enabled });
      await loadProfile(selectedProfileId);
      window.dispatchEvent(new Event("suricata-config-dirty"));
      toast.success("Preferencia de Telegram guardada; aplica cambios para recargar Suricata");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la notificación");
    }
  }

  async function handleDelete(entry: ListEntry) {
    try {
      await deleteListEntry(entry.list_type, entry.id);
      await loadProfile(selectedProfileId);
      window.dispatchEvent(new Event("suricata-config-dirty"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar la entrada");
    }
  }

  const activeRules = generatedRules.filter((rule) => entries.some((entry) => entry.id === rule.list_entry_id));

  return (
    <SectionCard
      eyebrow="Listas gestionadas"
      title="Blocklist / Allowlist"
      description="La lista blanca genera reglas pass. Los cambios se guardan aquí y se cargan en Suricata con el botón global Aplicar cambios."
    >
      <div className="mb-6 grid gap-4 lg:grid-cols-[22rem_1fr]">
        <FormPanel title="Perfil objetivo" description="Las entradas y sus reglas generadas pertenecen al perfil seleccionado.">
          <ProfileSelect profiles={profiles} value={selectedProfileId} onChange={(profileId) => void handleSelectProfile(profileId)} />
        </FormPanel>
        <div className="grid gap-3 sm:grid-cols-3">
          <Summary label="Entradas" value={entries.length} />
          <Summary label="Activas" value={entries.filter((entry) => entry.enabled).length} />
          <Summary label="Reglas visibles" value={activeRules.length} />
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-3 border-y border-soc-outline/45 py-4">
        {(["block", "allow"] as ListType[]).map((listType) => (
          <button className={`rounded-lg border px-4 py-2 text-sm font-black transition ${activeList === listType ? "border-soc-primary/65 bg-soc-blue/20 text-white" : "border-soc-outline/70 bg-soc-lowest text-soc-muted hover:text-white"}`} key={listType} onClick={() => void handleSelectList(listType)} type="button">
            {typeLabels[listType]}
          </button>
        ))}
      </div>

      <form className="mb-6" onSubmit={handleCreate}>
        <FormPanel title={`Nueva entrada: ${typeLabels[activeList]}`} description="Para dominios se generan reglas DNS, TLS SNI y HTTP host. Para IP/CIDR se usa la dirección seleccionada.">
          <div className="grid gap-3 lg:grid-cols-5">
            <label>
              <FieldLabel>Tipo</FieldLabel>
              <select className={selectClassName} onChange={(event) => setForm((current) => ({ ...current, entry_type: event.target.value as ListEntryType }))} value={form.entry_type}>
                <option value="domain">Dominio</option>
                <option value="ip">IP</option>
                <option value="cidr">CIDR</option>
              </select>
            </label>
            <label className="lg:col-span-2">
              <FieldLabel>Valor</FieldLabel>
              <input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))} placeholder="example.com / 1.2.3.4 / 10.0.0.0/24" required value={form.value} />
            </label>
            <label>
              <FieldLabel>Dirección</FieldLabel>
              <select className={selectClassName} disabled={form.entry_type === "domain"} onChange={(event) => setForm((current) => ({ ...current, direction: event.target.value as ListDirection }))} value={form.entry_type === "domain" ? "destination" : form.direction}>
                {Object.entries(directionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              <FieldLabel>Acción</FieldLabel>
              <select className={selectClassName} disabled={activeList === "allow"} onChange={(event) => setForm((current) => ({ ...current, action: event.target.value as ListAction }))} value={activeList === "allow" ? "pass" : form.action}>
                {activeList === "allow" ? <option value="pass">pass</option> : <><option value="drop">drop</option><option value="reject">reject</option></>}
              </select>
            </label>
          </div>
          <label>
            <FieldLabel>Motivo</FieldLabel>
            <input className={inputClassName} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Opcional" value={form.reason} />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 text-sm font-bold text-white">
              <input checked={form.enabled} onChange={() => setForm((current) => ({ ...current, enabled: !current.enabled }))} type="checkbox" />
              Habilitada
            </label>
            {activeList === "block" ? (
              <label className="inline-flex items-center gap-2 text-sm font-bold text-white">
                <input checked={form.notify_enabled} onChange={() => setForm((current) => ({ ...current, notify_enabled: !current.notify_enabled }))} type="checkbox" />
                Notificar por Telegram
              </label>
            ) : null}
            <ActionButton disabled={!selectedProfileId || saving} type="submit">Agregar entrada</ActionButton>
          </div>
        </FormPanel>
      </form>

      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <div className="grid gap-4">
          {entries.map((entry) => (
            <article className="rounded-xl border border-soc-outline/70 bg-soc-lowest/55 p-4" key={entry.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="font-mono text-sm font-black text-white">{entry.value}</h3>
                  <p className="mt-1 text-xs text-soc-muted">{entry.entry_type} · {directionLabels[entry.direction]} · {entry.reason || "Sin motivo"}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone={entry.enabled ? "success" : "muted"}>{entry.enabled ? "activa" : "inactiva"}</StatusPill>
                  <StatusPill tone={entry.action === "pass" ? "success" : entry.action === "reject" ? "warning" : "danger"}>{entry.action}</StatusPill>
                  {entry.list_type === "block" ? <StatusPill tone={entry.notify_enabled ? "success" : "muted"}>{entry.notify_enabled ? "Telegram" : "Sin Telegram"}</StatusPill> : null}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-soc-outline/50 pt-4">
                <div className="flex flex-wrap gap-4">
                  <label className="inline-flex items-center gap-2 text-sm font-bold text-white">
                    <input checked={entry.enabled} onChange={() => void handleToggle(entry)} type="checkbox" />
                    Incluir
                  </label>
                  {entry.list_type === "block" ? (
                    <label className="inline-flex items-center gap-2 text-sm font-bold text-white">
                      <input checked={entry.notify_enabled} onChange={() => void handleToggleNotification(entry)} type="checkbox" />
                      Notificar
                    </label>
                  ) : null}
                </div>
                <ActionButton onClick={() => void handleDelete(entry)} tone="danger"><IconTrash size={15} /> Eliminar</ActionButton>
              </div>
            </article>
          ))}
          {entries.length === 0 ? <EmptyState>No hay entradas en esta lista para el perfil seleccionado.</EmptyState> : null}
        </div>

        <div className="rounded-xl border border-soc-outline/70 bg-soc-lowest/55 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white">Reglas generadas</h3>
              <p className="mt-1 text-xs text-soc-muted">Vista previa de las reglas activas para la lista seleccionada.</p>
            </div>
            <StatusPill tone="primary"><IconEye size={13} /> preview</StatusPill>
          </div>
          <div className="grid max-h-160 gap-3 overflow-auto">
            {activeRules.map((rule) => <pre className="rounded-lg border border-soc-outline/55 bg-black/25 p-3 font-mono text-[11px] leading-5 text-soc-muted" key={`${rule.list_entry_id}-${rule.rule_text}`}>{rule.rule_text}</pre>)}
            {activeRules.length === 0 ? <EmptyState>No hay reglas generadas para esta vista.</EmptyState> : null}
          </div>
        </div>
      </div>
    </SectionCard>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-soc-outline/65 bg-soc-lowest/55 p-4">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-soc-muted">{label}</div>
      <div className="mt-1 text-2xl font-black text-white">{value}</div>
    </div>
  );
}
