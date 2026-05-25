import { authenticatedFetch } from "@/lib/auth-api";
import type {
  ApplyJob,
  ApplyMode,
  CustomRule,
  CustomRuleCreatePayload,
  CustomRuleUpdatePayload,
  NotificationSettings,
  NotificationSettingsUpdatePayload,
  ProfileCreatePayload,
  RuleOverride,
  RuleOverrideCreatePayload,
  RuleOverrideUpdatePayload,
  SuricataProfile,
  SuricataSource,
  SuricataStatus,
} from "@/types/suricata-management";

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    return typeof body.detail === "string" ? body.detail : `Request failed: ${response.status}`;
  } catch {
    return `Request failed: ${response.status}`;
  }
}

async function jsonRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await authenticatedFetch(path, options);
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<T>;
}

export function fetchSuricataStatus(): Promise<SuricataStatus> {
  return jsonRequest<SuricataStatus>("/api/suricata/status");
}

export function fetchProfiles(): Promise<SuricataProfile[]> {
  return jsonRequest<SuricataProfile[]>("/api/suricata/profiles");
}

export function createProfile(payload: ProfileCreatePayload): Promise<SuricataProfile> {
  return jsonRequest<SuricataProfile>("/api/suricata/profiles", { method: "POST", body: JSON.stringify(payload) });
}

export function activateProfile(profileId: string): Promise<SuricataProfile> {
  return jsonRequest<SuricataProfile>(`/api/suricata/profiles/${profileId}/activate`, { method: "POST" });
}

export async function deleteProfile(profileId: string): Promise<void> {
  const response = await authenticatedFetch(`/api/suricata/profiles/${profileId}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseError(response));
}

export function fetchSources(): Promise<SuricataSource[]> {
  return jsonRequest<SuricataSource[]>("/api/suricata/sources");
}

export function updateSource(sourceId: string, enabled: boolean): Promise<SuricataSource> {
  return jsonRequest<SuricataSource>(`/api/suricata/sources/${sourceId}`, { method: "PATCH", body: JSON.stringify({ enabled }) });
}

export function fetchRuleOverrides(profileId: string): Promise<RuleOverride[]> {
  return jsonRequest<RuleOverride[]>(`/api/suricata/profiles/${profileId}/rule-overrides`);
}

export function createRuleOverride(profileId: string, payload: RuleOverrideCreatePayload): Promise<RuleOverride> {
  return jsonRequest<RuleOverride>(`/api/suricata/profiles/${profileId}/rule-overrides`, { method: "POST", body: JSON.stringify(payload) });
}

export function updateRuleOverride(overrideId: string, payload: RuleOverrideUpdatePayload): Promise<RuleOverride> {
  return jsonRequest<RuleOverride>(`/api/suricata/rule-overrides/${overrideId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteRuleOverride(overrideId: string): Promise<void> {
  const response = await authenticatedFetch(`/api/suricata/rule-overrides/${overrideId}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseError(response));
}

export function fetchCustomRules(profileId: string): Promise<CustomRule[]> {
  return jsonRequest<CustomRule[]>(`/api/suricata/profiles/${profileId}/custom-rules`);
}

export function createCustomRule(profileId: string, payload: CustomRuleCreatePayload): Promise<CustomRule> {
  return jsonRequest<CustomRule>(`/api/suricata/profiles/${profileId}/custom-rules`, { method: "POST", body: JSON.stringify(payload) });
}

export function updateCustomRule(ruleId: string, payload: CustomRuleUpdatePayload): Promise<CustomRule> {
  return jsonRequest<CustomRule>(`/api/suricata/custom-rules/${ruleId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteCustomRule(ruleId: string): Promise<void> {
  const response = await authenticatedFetch(`/api/suricata/custom-rules/${ruleId}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseError(response));
}

export function applySuricataConfig(profileId?: string, mode: ApplyMode = "auto"): Promise<ApplyJob> {
  return jsonRequest<ApplyJob>("/api/suricata/apply", { method: "POST", body: JSON.stringify({ profile_id: profileId ?? null, mode }) });
}

export function fetchNotificationSettings(): Promise<NotificationSettings> {
  return jsonRequest<NotificationSettings>("/api/suricata/notification-settings");
}

export function updateNotificationSettings(payload: NotificationSettingsUpdatePayload): Promise<NotificationSettings> {
  return jsonRequest<NotificationSettings>("/api/suricata/notification-settings", { method: "PATCH", body: JSON.stringify(payload) });
}
