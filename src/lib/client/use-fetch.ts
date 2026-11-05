"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";

/** Tiny data-fetching hook with manual refresh and optional polling (revalidation). */
export function useFetch<T>(path: string | null, opts: { refreshMs?: number } = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const [refreshing, setRefreshing] = useState(false);
  const pathRef = useRef(path);
  useEffect(() => {
    pathRef.current = path;
  }, [path]);

  const load = useCallback(async (manual = false) => {
    const p = pathRef.current;
    if (!p) return;
    if (manual) setRefreshing(true);
    try {
      const d = await api<T>(p);
      if (pathRef.current === p) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (pathRef.current === p) setError(e instanceof ApiError ? e : new ApiError(String(e), 0, "ERROR"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!path) return;
    pathRef.current = path;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show skeleton while (re)loading a new resource
    setLoading(true);
    void load();
  }, [path, load]);

  useEffect(() => {
    if (!opts.refreshMs || !path) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, opts.refreshMs);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [opts.refreshMs, path, load]);

  return { data, error, loading, refreshing, refresh: () => load(true), setData };
}
