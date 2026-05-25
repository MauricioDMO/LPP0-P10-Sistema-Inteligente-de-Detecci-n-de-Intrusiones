import { authenticatedFetch } from "@/lib/auth-api";
import type { ApplyJob } from "@/types/suricata-management";
import type { GeneratedRulesResponse, ListEntry, ListEntryPayload, ListEntryUpdatePayload, ListType } from "@/types/lists";

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

export function fetchListEntries(listType: ListType, profileId: string): Promise<ListEntry[]> {
  return jsonRequest<ListEntry[]>(`/api/lists/${listType}?profile_id=${profileId}`);
}

export function createListEntry(listType: ListType, payload: ListEntryPayload): Promise<ListEntry> {
  return jsonRequest<ListEntry>(`/api/lists/${listType}`, { method: "POST", body: JSON.stringify(payload) });
}

export function updateListEntry(listType: ListType, entryId: string, payload: ListEntryUpdatePayload): Promise<ListEntry> {
  return jsonRequest<ListEntry>(`/api/lists/${listType}/${entryId}`, { method: "PATCH", body: JSON.stringify(payload) });
}

export async function deleteListEntry(listType: ListType, entryId: string): Promise<void> {
  const response = await authenticatedFetch(`/api/lists/${listType}/${entryId}`, { method: "DELETE" });
  if (!response.ok) throw new Error(await parseError(response));
}

export function fetchGeneratedRules(profileId: string): Promise<GeneratedRulesResponse> {
  return jsonRequest<GeneratedRulesResponse>(`/api/lists/generated-rules?profile_id=${profileId}`);
}

export function applyLists(profileId: string): Promise<ApplyJob> {
  return jsonRequest<ApplyJob>("/api/lists/apply", { method: "POST", body: JSON.stringify({ profile_id: profileId }) });
}
