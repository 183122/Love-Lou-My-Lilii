"use client";
import { ThemeProvider } from "next-themes";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { api, setCsrfToken } from "@/lib/client/api";
import type { SessionRole } from "@/lib/shared/types";

export interface PublicConfig {
  schoolName: string;
  schoolArea: string;
  systemName: string;
  systemNameEn: string;
  semester: string;
  academicYear: string;
  limits: { maxImageBytes: number; maxVideoBytes: number; maxFiles: number; allowedMime: string[] };
  chunkSize: number;
  publicDashboard: boolean;
  turnstileSiteKey: string | null;
  testMode: boolean;
}

interface AppCtx {
  config: PublicConfig | null;
  configError: string | null;
  role: SessionRole | null;
  sessionLoaded: boolean;
  refreshSession: () => Promise<void>;
  setSession: (s: { role: SessionRole | null; csrfToken?: string }) => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [role, setRole] = useState<SessionRole | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);

  const setSession = useCallback((s: { role: SessionRole | null; csrfToken?: string }) => {
    setRole(s.role);
    setCsrfToken(s.csrfToken ?? null);
  }, []);

  const refreshSession = useCallback(async () => {
    try {
      const s = await api<{ role: SessionRole | null; csrfToken?: string }>("/api/auth/session");
      setSession(s);
    } catch {
      setSession({ role: null });
    } finally {
      setSessionLoaded(true);
    }
  }, [setSession]);

  useEffect(() => {
    api<PublicConfig>("/api/public/config")
      .then(setConfig)
      .catch((e: Error) => setConfigError(e.message));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial session load (async; setState happens after await)
    void refreshSession();
  }, [refreshSession]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <Ctx.Provider value={{ config, configError, role, sessionLoaded, refreshSession, setSession }}>
        {children}
        <Toaster richColors position="top-center" closeButton />
      </Ctx.Provider>
    </ThemeProvider>
  );
}
