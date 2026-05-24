"use client";

import { IconTrash } from "@tabler/icons-react";
import { FormEvent, startTransition, useEffect, useState } from "react";
import { toast } from "sonner";
import { createRuleOverride, deleteRuleOverride, fetchProfiles, fetchRuleOverrides, fetchSuricataStatus, updateRuleOverride } from "@/lib/suricata-management-api";
import type { RuleOverride, SuricataProfile } from "@/types/suricata-management";
import { ACTION_LABELS, ACTIONS, ACTION_TONE, ActionButton, EmptyState, FieldLabel, FormPanel, InfoPanel, inputClassName, ProfileSelect, SectionCard, selectClassName, StatusPill } from "./suricata-ui";

export function SuricataOverridesPage() {
  const [profiles, setProfiles] = useState<SuricataProfile[]>([]);
  const [overrides, setOverrides] = useState<RuleOverride[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [saving, setSaving] = useState(false);
  const [overrideForm, setOverrideForm] = useState({ gid: 1, sid: "", action: "drop" as RuleOverride["action"], reason: "" });

  async function loadProfileDetails(profileId: string) {
    if (!profileId) {
      setOverrides([]);
      return;
    }
    setOverrides(await fetchRuleOverrides(profileId));
  }

  useEffect(() => {
    startTransition(() => {
      async function loadInitial() {
        try {
          const [status, nextProfiles] = await Promise.all([fetchSuricataStatus(), fetchProfiles()]);
          const nextProfileId = status.active_profile?.id || nextProfiles[0]?.id || "";
          const nextOverrides = nextProfileId ? await fetchRuleOverrides(nextProfileId) : [];
          setProfiles(nextProfiles);
          setSelectedProfileId(nextProfileId);
          setOverrides(nextOverrides);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "No se pudo cargar overrides");
        }
      }

      void loadInitial();
    });
  }, []);

  async function handleSelectProfile(profileId: string) {
    setSelectedProfileId(profileId);
    try {
      await loadProfileDetails(profileId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el perfil");
    }
  }

  async function handleCreateOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfileId) return;
    setSaving(true);
    try {
      await createRuleOverride(selectedProfileId, { gid: overrideForm.gid, sid: Number(overrideForm.sid), action: overrideForm.action, reason: overrideForm.reason || null, enabled: true, notify_enabled: false });
      setOverrideForm({ gid: 1, sid: "", action: "drop", reason: "" });
      await loadProfileDetails(selectedProfileId);
      toast.success("Override agregado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear override");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(overrideId: string) {
    try {
      await deleteRuleOverride(overrideId);
      await loadProfileDetails(selectedProfileId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar override");
    }
  }

  async function handleToggleNotification(override: RuleOverride) {
    try {
      const updated = await updateRuleOverride(override.id, { notify_enabled: !override.notify_enabled });
      setOverrides((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la notificación");
    }
  }

  return (
    <SectionCard eyebrow="Reglas existentes" title="Overrides por SID" description="Usa esta sección cuando ya conoces el SID de una regla y quieres cambiar su comportamiento para un perfil concreto.">
      <div className="mb-4 grid gap-3 lg:grid-cols-[22rem_1fr]">
        <FormPanel title="Perfil objetivo" description="Los overrides se guardan dentro del perfil seleccionado.">
          <ProfileSelect profiles={profiles} value={selectedProfileId} onChange={(profileId) => void handleSelectProfile(profileId)} />
        </FormPanel>
        <InfoPanel title="Cuándo usarlo">
          Un override es ideal para falsos positivos o para convertir una alerta específica en bloqueo IPS. Si necesitas una firma nueva, usa Reglas locales.
        </InfoPanel>
      </div>

      <form className="mb-4" onSubmit={handleCreateOverride}>
        <FormPanel title="Agregar override" description="Indica la regla por GID:SID y el comportamiento deseado.">
          <div className="grid gap-3 lg:grid-cols-[0.5fr_1fr_1.2fr_1.4fr_auto] lg:items-end">
            <label>
              <FieldLabel>GID</FieldLabel>
              <input className={inputClassName} min={1} onChange={(event) => setOverrideForm((current) => ({ ...current, gid: Number(event.target.value) }))} type="number" value={overrideForm.gid} />
            </label>
            <label>
              <FieldLabel>SID</FieldLabel>
              <input className={inputClassName} min={1} onChange={(event) => setOverrideForm((current) => ({ ...current, sid: event.target.value }))} placeholder="2019401" required type="number" value={overrideForm.sid} />
            </label>
            <label>
              <FieldLabel>Acción</FieldLabel>
              <select className={selectClassName} onChange={(event) => setOverrideForm((current) => ({ ...current, action: event.target.value as RuleOverride["action"] }))} value={overrideForm.action}>
                {ACTIONS.map((action) => <option key={action} value={action}>{ACTION_LABELS[action]}</option>)}
              </select>
            </label>
            <label>
              <FieldLabel>Motivo</FieldLabel>
              <input className={inputClassName} onChange={(event) => setOverrideForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Falso positivo, prueba IPS, etc." value={overrideForm.reason} />
            </label>
            <ActionButton disabled={!selectedProfileId || saving} type="submit">Agregar</ActionButton>
          </div>
        </FormPanel>
      </form>

      <div className="grid gap-3">
        {overrides.map((override) => (
          <article className="rounded-xl border border-soc-outline/70 bg-soc-lowest/55 p-3" key={override.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-mono text-lg font-black text-white">{override.gid}:{override.sid}</div>
                <p className="mt-1 text-sm text-soc-muted">{override.reason || "Sin motivo registrado"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone={ACTION_TONE[override.action]}>{ACTION_LABELS[override.action]}</StatusPill>
                <StatusPill tone={override.notify_enabled ? "success" : "muted"}>{override.notify_enabled ? "Telegram" : "Sin Telegram"}</StatusPill>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-soc-outline/50 pt-3">
              <label className="inline-flex items-center gap-2 text-sm font-bold text-white">
                <input checked={override.notify_enabled} onChange={() => void handleToggleNotification(override)} type="checkbox" />
                Notificar por Telegram
              </label>
              <ActionButton onClick={() => void handleDelete(override.id)} tone="danger"><IconTrash size={15} /> Eliminar</ActionButton>
            </div>
          </article>
        ))}
        {overrides.length === 0 ? <EmptyState>No hay overrides para este perfil.</EmptyState> : null}
      </div>
    </SectionCard>
  );
}
