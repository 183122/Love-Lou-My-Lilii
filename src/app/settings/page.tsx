"use client";
import * as Tabs from "@radix-ui/react-tabs";
import { useEffect, useState } from "react";
import { AccessGate } from "@/components/auth/access-gate";
import { LoadError } from "@/components/dashboard/setup-notice";
import { DriveTab } from "@/components/settings/drive-tab";
import { EvidenceTab } from "@/components/settings/evidence-tab";
import { DisplayTab, GeneralTab, UploadTab } from "@/components/settings/general-tab";
import { IndicatorsTab } from "@/components/settings/indicators-tab";
import { SecurityTab } from "@/components/settings/security-tab";
import { useSettings } from "@/components/settings/use-settings";
import { PageHeader, Skeleton } from "@/components/ui/misc";

const TABS = [
  ["general", "ข้อมูลโรงเรียน/ระบบ"],
  ["drive", "Google Drive"],
  ["indicators", "หมวดและตัวชี้วัด"],
  ["upload", "ไฟล์และการอัปโหลด"],
  ["evidence", "จัดการหลักฐาน"],
  ["display", "การแสดงผล"],
  ["security", "ความปลอดภัย"],
] as const;

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="ตั้งค่าระบบ" description="สำหรับผู้ดูแลระบบเท่านั้น" />
      <AccessGate need="ADMIN">
        <SettingsBody />
      </AccessGate>
    </>
  );
}

function SettingsBody() {
  const s = useSettings();
  const [tab, setTab] = useState("general");
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read deep-link tab from URL after hydration
    if (t && TABS.some(([k]) => k === t)) setTab(t);
  }, []);
  if (s.error && !s.data) return <LoadError error={s.error} onRetry={s.refresh} />;
  if (!s.data) return <Skeleton className="h-96" />;
  const p = { settings: s.data.settings, save: s.save, saving: s.saving };
  return (
    <Tabs.Root value={tab} onValueChange={setTab}>
      <Tabs.List className="glass mb-4 flex gap-1 overflow-x-auto rounded-2xl p-1.5" aria-label="หมวดการตั้งค่า">
        {TABS.map(([k, label]) => (
          <Tabs.Trigger
            key={k}
            value={k}
            className="shrink-0 rounded-xl px-3 py-2 text-sm text-slate-600 transition data-[state=active]:bg-white data-[state=active]:font-medium data-[state=active]:text-violet-700 data-[state=active]:shadow dark:text-slate-300 dark:data-[state=active]:bg-slate-800 dark:data-[state=active]:text-violet-200"
          >
            {label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value="general"><GeneralTab {...p} /></Tabs.Content>
      <Tabs.Content value="drive"><DriveTab {...p} /></Tabs.Content>
      <Tabs.Content value="indicators"><IndicatorsTab /></Tabs.Content>
      <Tabs.Content value="upload"><UploadTab {...p} /></Tabs.Content>
      <Tabs.Content value="evidence"><EvidenceTab /></Tabs.Content>
      <Tabs.Content value="display"><DisplayTab {...p} /></Tabs.Content>
      <Tabs.Content value="security"><SecurityTab data={s.data} save={s.save} saving={s.saving} reload={s.refresh} /></Tabs.Content>
    </Tabs.Root>
  );
}
