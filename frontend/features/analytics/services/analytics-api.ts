import { API_URL } from "@/lib/config";

export async function fetchAnalytics<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Analytics request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
