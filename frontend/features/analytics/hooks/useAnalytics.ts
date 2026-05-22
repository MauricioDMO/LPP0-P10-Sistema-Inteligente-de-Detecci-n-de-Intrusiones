"use client";

import { useEffect, useState } from "react";
import { fetchAnalytics } from "@/features/analytics/services/analytics-api";

export function useAnalytics<T>(path: string) {
  const [state, setState] = useState<{ path: string; data: T | null; error: string | null }>({
    path: "",
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    fetchAnalytics<T>(path)
      .then((value) => {
        if (!cancelled) setState({ path, data: value, error: null });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({
            path,
            data: null,
            error: err instanceof Error ? err.message : "Error cargando analytics",
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  const loading = state.path !== path;

  return {
    data: loading ? null : state.data,
    loading,
    error: loading ? null : state.error,
  };
}
