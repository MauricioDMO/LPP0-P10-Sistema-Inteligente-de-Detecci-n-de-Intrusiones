import { authenticatedFetch } from "@/lib/auth-api";

export async function fetchAnalytics<T>(path: string): Promise<T> {
  const response = await authenticatedFetch(path);

  if (!response.ok) {
    throw new Error(`Analytics request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
