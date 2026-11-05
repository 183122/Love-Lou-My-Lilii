"use client";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client/api";
import { useFetch } from "@/lib/client/use-fetch";

export interface AdminSettings {
  schoolName: string;
  schoolArea: string;
  systemName: string;
  systemNameEn: string;
  semester: string;
  academicYear: string;
  maxImageMb: number;
  maxVideoMb: number;
  maxFiles: number;
  allowedTypes: string[];
  publicDashboard: boolean;
  showRecentSubmitters: boolean;
  requireTurnstile: boolean;
  driveRootFolderName: string;
  driveRootFolderId: string;
}

export interface SettingsResponse {
  settings: AdminSettings;
  security: { viewerCodeEnabled: boolean; turnstileConfigured: boolean; rootFolderFromEnv: boolean; driveScope: string };
}

export function useSettings() {
  const f = useFetch<SettingsResponse>("/api/admin/settings");
  const [saving, setSaving] = useState(false);
  const save = async (patch: Partial<AdminSettings>) => {
    setSaving(true);
    try {
      const r = await api<{ settings: AdminSettings }>("/api/admin/settings", { method: "PUT", json: patch });
      f.setData((d) => d && { ...d, settings: r.settings });
      toast.success("บันทึกการตั้งค่าแล้ว");
      return true;
    } catch (e) {
      toast.error((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  };
  return { ...f, save, saving };
}
