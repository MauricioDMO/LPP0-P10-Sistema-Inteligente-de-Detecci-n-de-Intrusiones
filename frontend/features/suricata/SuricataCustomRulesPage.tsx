"use client";

import { IconTrash } from "@tabler/icons-react";
import { FormEvent, startTransition, useEffect, useState } from "react";
import { toast } from "sonner";
import { createCustomRule, deleteCustomRule, fetchCustomRules, fetchProfiles, fetchSuricataStatus, updateCustomRule } from "@/lib/suricata-management-api";
import type { CustomRule, SuricataProfile } from "@/types/suricata-management";
import { ActionButton, EmptyState, FieldLabel, FormPanel, inputClassName, ProfileSelect, SectionCard, StatusPill, statusClass, textareaClassName } from "./suricata-ui";

export function SuricataCustomRulesPage() {
  const [profiles, setProfiles] = useState<SuricataProfile[]>([]);
  const [customRules, setCustomRules] = useState<CustomRule[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [saving, setSaving] = useState(false);
  const [ruleForm, setRuleForm] = useState({ name: "", description: "", rule_text: "alert icmp any any -> any any (msg:\"PING detectado\"; sid:1000001; rev:1;)", enabled: true });

  async function loadProfileDetails(profileId: string) {
    if (!profileId) {
      setCustomRules([]);
      return;
    }
    setCustomRules(await fetchCustomRules(profileId));
  }

  useEffect(() => {
    startTransition(() => {
      async function loadInitial() {
        try {
          const [status, nextProfiles] = await Promise.all([fetchSuricataStatus(), fetchProfiles()]);
          const nextProfileId = status.active_profile?.id || nextProfiles[0]?.id || "";
          const nextCustomRules = nextProfileId ? await fetchCustomRules(nextProfileId) : [];
          setProfiles(nextProfiles);
          setSelectedProfileId(nextProfileId);
          setCustomRules(nextCustomRules);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "No se pudo cargar reglas personalizadas");
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

  async function handleCreateCustomRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProfileId) return;
    setSaving(true);
    try {
      const rule = await createCustomRule(selectedProfileId, { ...ruleForm, description: ruleForm.description || null });
      await loadProfileDetails(selectedProfileId);
      window.dispatchEvent(new Event("suricata-config-dirty"));
      toast[rule.validation_status === "valid" ? "success" : "warning"](rule.validation_status === "valid" ? "Regla custom válida" : rule.validation_error ?? "Regla custom inválida");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear regla custom");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleCustomRule(rule: CustomRule) {
    try {
      const updated = await updateCustomRule(rule.id, { enabled: !rule.enabled });
      setCustomRules((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      window.dispatchEvent(new Event("suricata-config-dirty"));
      toast.success("Regla guardada; aplica cambios para recargar Suricata");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la regla");
    }
  }

  async function handleToggleNotification(rule: CustomRule) {
    try {
      const updated = await updateCustomRule(rule.id, { notify_enabled: !rule.notify_enabled });
      setCustomRules((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success("Preferencia de Telegram guardada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo actualizar la notificación");
    }
  }

  async function handleDelete(ruleId: string) {
    try {
      await deleteCustomRule(ruleId);
      await loadProfileDetails(selectedProfileId);
      window.dispatchEvent(new Event("suricata-config-dirty"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar regla custom");
    }
  }

  return (
    <SectionCard eyebrow="Firmas locales" title="Reglas personalizadas" description="Agrega reglas Suricata propias para el perfil seleccionado. Solo las reglas activas y válidas se incluyen al aplicar configuración.">
      <div className="mb-6 grid gap-4 lg:grid-cols-[22rem_1fr]">
        <FormPanel title="Perfil objetivo" description="Las reglas locales se guardan dentro del perfil seleccionado.">
          <ProfileSelect profiles={profiles} value={selectedProfileId} onChange={(profileId) => void handleSelectProfile(profileId)} />
        </FormPanel>
        <div className="rounded-xl border border-soc-outline/65 bg-soc-lowest/55 p-4 sm:p-5">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-soc-muted">Resumen</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill tone="success">{customRules.filter((rule) => rule.enabled).length} activas</StatusPill>
            <StatusPill tone="danger">{customRules.filter((rule) => rule.validation_status === "invalid").length} inválidas</StatusPill>
            <StatusPill tone="muted">{customRules.length} total</StatusPill>
          </div>
        </div>
      </div>

      <form className="mb-6" onSubmit={handleCreateCustomRule}>
        <FormPanel title="Nueva regla local" description="Escribe una regla completa de Suricata. El backend la valida al guardarla.">
          <div className="grid gap-3 lg:grid-cols-2">
            <label>
              <FieldLabel>Nombre</FieldLabel>
              <input className={inputClassName} onChange={(event) => setRuleForm((current) => ({ ...current, name: event.target.value }))} placeholder="Detectar ping" required value={ruleForm.name} />
            </label>
            <label>
              <FieldLabel>Descripción</FieldLabel>
              <input className={inputClassName} onChange={(event) => setRuleForm((current) => ({ ...current, description: event.target.value }))} placeholder="Opcional" value={ruleForm.description} />
            </label>
          </div>
          <label>
            <FieldLabel>Texto de la regla</FieldLabel>
            <textarea className={textareaClassName} onChange={(event) => setRuleForm((current) => ({ ...current, rule_text: event.target.value }))} required value={ruleForm.rule_text} />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-soc-muted">Ejemplo: alert icmp any any -&gt; any any (msg:&quot;PING detectado&quot;; sid:1000001; rev:1;)</p>
            <ActionButton disabled={!selectedProfileId || saving} type="submit">Agregar regla</ActionButton>
          </div>
        </FormPanel>
      </form>

      <div className="grid gap-4">
        {customRules.map((rule) => (
          <article className="rounded-xl border border-soc-outline/70 bg-soc-lowest/55 p-4" key={rule.id}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h3 className="text-base font-black text-white">{rule.name}</h3>
                <p className="mt-1 text-sm text-soc-muted">{rule.description || "Sin descripción"}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill tone={rule.enabled ? "success" : "muted"}>{rule.enabled ? "activa" : "inactiva"}</StatusPill>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${statusClass(rule.validation_status)}`}>{rule.validation_status}</span>
                <StatusPill tone={rule.notify_enabled ? "success" : "muted"}>{rule.notify_enabled ? "Telegram" : "Sin Telegram"}</StatusPill>
              </div>
            </div>
            {rule.validation_error ? <p className="mt-3 rounded-lg border border-soc-danger/35 bg-soc-danger/10 p-2 text-xs text-red-200">{rule.validation_error}</p> : null}
            <pre className="mt-4 max-h-44 overflow-auto rounded-lg border border-soc-outline/60 bg-black/25 p-3 font-mono text-[11px] leading-5 text-soc-muted">{rule.rule_text}</pre>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-soc-outline/50 pt-4">
              <div className="flex flex-wrap gap-4">
                <label className="inline-flex items-center gap-2 text-sm font-bold text-white">
                  <input checked={rule.enabled} onChange={() => void handleToggleCustomRule(rule)} type="checkbox" />
                  Incluir regla
                </label>
                <label className="inline-flex items-center gap-2 text-sm font-bold text-white">
                  <input checked={rule.notify_enabled} onChange={() => void handleToggleNotification(rule)} type="checkbox" />
                  Notificar
                </label>
              </div>
              <ActionButton onClick={() => void handleDelete(rule.id)} tone="danger"><IconTrash size={15} /> Eliminar</ActionButton>
            </div>
          </article>
        ))}
        {customRules.length === 0 ? <EmptyState>No hay reglas personalizadas para este perfil.</EmptyState> : null}
      </div>
    </SectionCard>
  );
}
