"use client";

import { IconPlus, IconTrash } from "@tabler/icons-react";
import { FormEvent, startTransition, useEffect, useState } from "react";
import { toast } from "sonner";
import { fetchNotificationSettings, updateNotificationSettings } from "@/lib/suricata-management-api";
import type { NotificationSettings, TelegramChatRecipient } from "@/types/suricata-management";
import { ActionButton, FieldLabel, FormPanel, inputClassName, SectionCard, StatusPill } from "./suricata-ui";

const DEFAULT_RECIPIENT: TelegramChatRecipient = { name: "", chat_id: "" };

export function SuricataNotificationsPage() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [recipients, setRecipients] = useState<TelegramChatRecipient[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    startTransition(() => {
      async function load() {
        try {
          const nextSettings = await fetchNotificationSettings();
          setSettings(nextSettings);
          setRecipients(nextSettings.telegram_chat_recipients.length ? nextSettings.telegram_chat_recipients : [{ ...DEFAULT_RECIPIENT }]);
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "No se pudo cargar notificaciones");
        }
      }

      void load();
    });
  }, []);

  function updateRecipient(index: number, values: Partial<TelegramChatRecipient>) {
    setRecipients((current) => current.map((recipient, currentIndex) => (currentIndex === index ? { ...recipient, ...values } : recipient)));
  }

  function removeRecipient(index: number) {
    setRecipients((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) return;
    setSaving(true);
    try {
      const cleanRecipients = recipients.map((recipient) => ({ name: recipient.name.trim(), chat_id: recipient.chat_id.trim() })).filter((recipient) => recipient.name && recipient.chat_id);
      const nextSettings = await updateNotificationSettings({ ...settings, telegram_chat_recipients: cleanRecipients });
      setSettings(nextSettings);
      setRecipients(nextSettings.telegram_chat_recipients.length ? nextSettings.telegram_chat_recipients : [{ ...DEFAULT_RECIPIENT }]);
      toast.success("Notificaciones actualizadas");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar notificaciones");
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return <SectionCard title="Notificaciones" description="Cargando configuración de Telegram..."><div /></SectionCard>;
  }

  return (
    <SectionCard eyebrow="Alertas" title="Notificaciones Telegram" description="Configura destinatarios, buffer y zona horaria. Estos cambios los usa el backend al instante; no requieren aplicar ni recargar Suricata.">
      <form className="grid gap-6" onSubmit={handleSave}>
        <FormPanel title="Comportamiento general" description="Define si Telegram está activo y si las alertas se envían una por una o agrupadas.">
          <div className="grid gap-3 lg:grid-cols-4">
            <label className="flex min-h-20 items-center justify-between gap-3 rounded-xl border border-soc-outline/60 bg-soc-low/60 p-3 text-sm font-bold text-white">
              <span>Telegram activo</span>
              <input checked={settings.telegram_enabled} onChange={(event) => setSettings((current) => current ? { ...current, telegram_enabled: event.target.checked } : current)} type="checkbox" />
            </label>
            <label className="flex min-h-20 items-center justify-between gap-3 rounded-xl border border-soc-outline/60 bg-soc-low/60 p-3 text-sm font-bold text-white">
              <span>Agrupar alertas</span>
              <input checked={settings.buffer_enabled} onChange={(event) => setSettings((current) => current ? { ...current, buffer_enabled: event.target.checked } : current)} type="checkbox" />
            </label>
            <label>
              <FieldLabel>Buffer en minutos</FieldLabel>
              <input className={inputClassName} min={1} onChange={(event) => setSettings((current) => current ? { ...current, buffer_minutes: Number(event.target.value) } : current)} type="number" value={settings.buffer_minutes} />
            </label>
            <label>
              <FieldLabel>Zona horaria</FieldLabel>
              <input className={inputClassName} onChange={(event) => setSettings((current) => current ? { ...current, timezone: event.target.value } : current)} placeholder="UTC o UTC-5" value={settings.timezone} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill tone={settings.telegram_enabled ? "success" : "muted"}>{settings.telegram_enabled ? "Telegram activo" : "Telegram apagado"}</StatusPill>
            <StatusPill tone={settings.buffer_enabled ? "primary" : "muted"}>{settings.buffer_enabled ? `Buffer ${settings.buffer_minutes} min` : "Sin buffer"}</StatusPill>
          </div>
        </FormPanel>

        <div className="rounded-xl border border-soc-outline/70 bg-soc-lowest/60 p-4 sm:p-5">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-black uppercase tracking-[0.12em] text-white">Chats destino</h3>
              <p className="mt-1 text-xs text-soc-muted">Asigna un nombre para reconocer a quién pertenece cada chat ID.</p>
            </div>
            <ActionButton onClick={() => setRecipients((current) => [...current, { ...DEFAULT_RECIPIENT }])}><IconPlus size={15} /> Agregar</ActionButton>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {recipients.map((recipient, index) => (
              <div className="grid gap-3 rounded-xl border border-soc-outline/60 bg-soc-low/60 p-4" key={index}>
                <div className="flex items-center justify-between gap-2">
                  <StatusPill tone="primary">Chat {index + 1}</StatusPill>
                  <button className="rounded-lg border border-soc-outline/70 bg-soc-low px-2 py-1 text-soc-muted transition hover:border-soc-danger/45 hover:text-red-200" onClick={() => removeRecipient(index)} type="button" title="Eliminar destinatario">
                    <IconTrash size={16} />
                  </button>
                </div>
                <label>
                  <FieldLabel>Nombre</FieldLabel>
                  <input className={inputClassName} onChange={(event) => updateRecipient(index, { name: event.target.value })} placeholder="Mauricio" value={recipient.name} />
                </label>
                <label>
                  <FieldLabel>Chat ID</FieldLabel>
                  <input className={inputClassName} onChange={(event) => updateRecipient(index, { chat_id: event.target.value })} placeholder="123456789" value={recipient.chat_id} />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <ActionButton disabled={saving} type="submit">Guardar notificaciones</ActionButton>
        </div>
      </form>
    </SectionCard>
  );
}
