"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { AUTH_SESSION_EXPIRED_EVENT, fetchCurrentUser, loginRequest, logoutRequest } from "@/lib/auth-api";
import type { AuthUser } from "@/types/auth";

type AuthContextValue = {
  user: AuthUser | null;
  roles: string[];
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (...roles: string[]) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetchCurrentUser()
      .then((currentUser) => {
        if (!cancelled) setUser(currentUser);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handleSessionExpired() {
      setUser(null);
      setIsLoading(false);
    }

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
    return () => window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);
  }, []);

  async function login(username: string, password: string) {
    const response = await loginRequest(username, password);
    setUser(response.user);
    setIsLoading(false);
  }

  async function logout() {
    await logoutRequest().catch(() => undefined);
    setUser(null);
    setIsLoading(false);
  }

  const value = useMemo<AuthContextValue>(() => {
    const roles = user?.roles ?? [];
    return {
      user,
      roles,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      logout,
      hasRole: (...allowedRoles: string[]) => roles.some((role) => allowedRoles.includes(role)),
    };
  }, [isLoading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return context;
}
