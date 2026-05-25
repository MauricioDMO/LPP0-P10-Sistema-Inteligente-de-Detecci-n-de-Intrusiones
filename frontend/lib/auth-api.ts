import { API_URL } from "@/lib/config";
import type { AuthUser, LoginResponse, UserCreatePayload, UserUpdatePayload, UsersListResponse } from "@/types/auth";

const CSRF_COOKIE_NAME = "suricata_csrf";
export const AUTH_SESSION_EXPIRED_EVENT = "suricata-auth-session-expired";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;

  const value = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`))
    ?.split("=")[1];

  return value ? decodeURIComponent(value) : null;
}

type FastApiValidationError = {
  loc?: Array<string | number>;
  msg?: string;
  type?: string;
};

function formatErrorDetail(detail: unknown): string | null {
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail)) {
    const messages = detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return null;

        const validationError = item as FastApiValidationError;
        const location = validationError.loc?.filter((part) => part !== "body").join(".");
        const message = validationError.msg ?? validationError.type;
        if (!message) return null;
        return location ? `${location}: ${message}` : message;
      })
      .filter(Boolean);

    return messages.length > 0 ? messages.join("; ") : null;
  }

  if (detail && typeof detail === "object") {
    const validationError = detail as FastApiValidationError;
    if (validationError.msg) return validationError.msg;
  }

  return null;
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown; message?: unknown };
    return formatErrorDetail(body.detail) ?? formatErrorDetail(body.message) ?? `Request failed: ${response.status}`;
  } catch {
    return `Request failed: ${response.status}`;
  }
}

export async function loginRequest(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<LoginResponse>;
}

export async function authenticatedFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers = new Headers(options.headers);
  const method = options.method?.toUpperCase() ?? "GET";

  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && !headers.has("X-CSRF-Token")) {
    const csrfToken = getCookie(CSRF_COOKIE_NAME);
    if (csrfToken) headers.set("X-CSRF-Token", csrfToken);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
    cache: "no-store",
  });

  if (response.status === 401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
    window.location.assign(`/login?next=${next}`);
  }

  return response;
}

async function authenticatedJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await authenticatedFetch(path, options);
  if (!response.ok) throw new Error(await parseError(response));
  return response.json() as Promise<T>;
}

export function fetchCurrentUser(): Promise<AuthUser> {
  return fetch(`${API_URL}/api/auth/me`, {
    credentials: "include",
    cache: "no-store",
  }).then(async (response) => {
    if (!response.ok) throw new Error(await parseError(response));
    return response.json() as Promise<AuthUser>;
  });
}

export async function logoutRequest(): Promise<void> {
  const response = await authenticatedFetch("/api/auth/logout", { method: "POST" });

  if (!response.ok && response.status !== 401) throw new Error(await parseError(response));
}

export function fetchUsers(): Promise<UsersListResponse> {
  return authenticatedJson<UsersListResponse>("/api/auth/users");
}

export function createUser(payload: UserCreatePayload): Promise<AuthUser> {
  return authenticatedJson<AuthUser>("/api/auth/users", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateUser(userId: string, payload: UserUpdatePayload): Promise<AuthUser> {
  return authenticatedJson<AuthUser>(`/api/auth/users/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deactivateUser(userId: string): Promise<AuthUser> {
  return authenticatedJson<AuthUser>(`/api/auth/users/${userId}`, { method: "DELETE" });
}
