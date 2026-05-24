"use client";

import { IconTrash } from "@tabler/icons-react";
import { FormEvent, startTransition, useEffect, useState } from "react";
import { toast } from "sonner";
import { activateProfile, createProfile, deleteProfile, fetchProfiles, fetchSuricataStatus } from "@/lib/suricata-management-api";
import type { SuricataProfile } from "@/types/suricata-management";
import { ActionButton, EmptyState, FieldLabel, FormPanel, inputClassName, SectionCard, selectClassName, StatusPill } from "./suricata-ui";

export function SuricataProfilesPage() {
  const [profiles, setProfiles] = useState<SuricataProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", description: "", mode: "IPS" as "IDS" | "IPS", sensitivity: "medium" as "low" | "medium" | "high" });

  async function load() {
    setLoading(true);
    try {
      const [status, nextProfiles] = await Promise.all([fetchSuricataStatus(), fetchProfiles()]);
      setProfiles(nextProfiles);
      setSelectedProfileId((current) => current || status.active_profile?.id || nextProfiles[0]?.id || "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar perfiles");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    startTransition(() => {
      void load();
    });
  }, []);

  async function handleCreateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const profile = await createProfile({ ...profileForm, description: profileForm.description || null });
      toast.success("Perfil creado");
      setProfileForm({ name: "", description: "", mode: "IPS", sensitivity: "medium" });
      setSelectedProfileId(profile.id);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo crear el perfil");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivateProfile(profileId: string) {
    setSaving(true);
    try {
      await activateProfile(profileId);
      toast.success("Perfil activo actualizado");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo activar el perfil");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteProfile(profile: SuricataProfile) {
    if (profile.is_active) return;
    if (!window.confirm(`Eliminar el perfil "${profile.name}" y sus reglas/overrides?`)) return;
    setSaving(true);
    try {
      await deleteProfile(profile.id);
      toast.success("Perfil eliminado");
      if (selectedProfileId === profile.id) setSelectedProfileId("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo eliminar el perfil");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard eyebrow="Política base" title="Perfiles" description="Cada perfil agrupa modo, sensibilidad, overrides y reglas locales. Solo el perfil activo se usa al aplicar configuración.">
      <div className="grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
        <form className="grid gap-3" onSubmit={handleCreateProfile}>
          <FormPanel title="Crear perfil" description="Usa perfiles separados para laboratorio, monitoreo y bloqueo activo.">
          <label>
            <FieldLabel>Nombre</FieldLabel>
            <input className={inputClassName} onChange={(event) => setProfileForm((current) => ({ ...current, name: event.target.value }))} placeholder="IPS moderado" required value={profileForm.name} />
          </label>
          <label>
            <FieldLabel>Descripción</FieldLabel>
            <input className={inputClassName} onChange={(event) => setProfileForm((current) => ({ ...current, description: event.target.value }))} placeholder="Política de laboratorio" value={profileForm.description} />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <FieldLabel>Modo</FieldLabel>
              <select className={selectClassName} onChange={(event) => setProfileForm((current) => ({ ...current, mode: event.target.value as "IDS" | "IPS" }))} value={profileForm.mode}>
                <option value="IDS">IDS, solo monitoreo</option>
                <option value="IPS">IPS, bloqueo activo</option>
              </select>
            </label>
            <label>
              <FieldLabel>Sensibilidad</FieldLabel>
              <select className={selectClassName} onChange={(event) => setProfileForm((current) => ({ ...current, sensitivity: event.target.value as "low" | "medium" | "high" }))} value={profileForm.sensitivity}>
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </label>
          </div>
          <ActionButton disabled={saving} type="submit">Crear perfil</ActionButton>
          </FormPanel>
        </form>

        <div className="grid gap-3">
          {profiles.map((profile) => (
            <article className={`rounded-xl border p-3 transition ${selectedProfileId === profile.id ? "border-soc-primary/55 bg-soc-blue/12" : "border-soc-outline/70 bg-soc-lowest/55 hover:border-soc-primary/35"}`} key={profile.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <button className="text-left" onClick={() => setSelectedProfileId(profile.id)} type="button">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-black text-white hover:text-soc-primary">{profile.name}</h3>
                    {profile.is_active ? <StatusPill tone="success">activo</StatusPill> : null}
                  </div>
                  <p className="mt-1 text-sm text-soc-muted">{profile.description || "Sin descripción"}</p>
                </button>
                <div className="flex flex-wrap gap-2">
                  <StatusPill tone={profile.mode === "IPS" ? "warning" : "primary"}>{profile.mode}</StatusPill>
                  <StatusPill tone="muted">{profile.sensitivity}</StatusPill>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-soc-outline/50 pt-3">
                <ActionButton disabled={profile.is_active || saving} onClick={() => void handleActivateProfile(profile.id)} tone="ghost">Activar</ActionButton>
                <ActionButton disabled={profile.is_active || saving} onClick={() => void handleDeleteProfile(profile)} tone="danger"><IconTrash size={15} /> Eliminar</ActionButton>
              </div>
            </article>
          ))}
          {!loading && profiles.length === 0 ? <EmptyState>No hay perfiles creados.</EmptyState> : null}
        </div>
      </div>
    </SectionCard>
  );
}
