import { authenticatedFetch } from "@/lib/auth-api";
import type { SystemOverview } from "@/types/system";

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown; error?: unknown };
    return typeof body.detail === "string"
      ? body.detail
      : typeof body.error === "string"
        ? body.error
        : `Request failed: ${response.status}`;
  } catch {
    return `Request failed: ${response.status}`;
  }
}

export async function fetchSystemOverview(hours = 24): Promise<SystemOverview> {
  const response = await authenticatedFetch(`/api/system/overview?hours=${hours}`);
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<SystemOverview>;
}
