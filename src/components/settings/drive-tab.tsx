"use client";
import { AlertTriangle, CheckCircle2, FolderTree, Link2, Loader2, RefreshCw, Save, Unplug } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/client/api";
import { useFetch } from "@/lib/client/use-fetch";
import type { AdminSettings } from "./use-settings";

interface DriveStatus {
  configured: boolean;
  connected: boolean;
  tokenSource: "database" | "env" | null;
  account: string | null;
  scope: string | null;
  rootFolderId: string | null;
  rootFolderName: string | null;
  rootAccessible: boolean;
  rootWritable: boolean;
  foldersMapped: number;
  foldersExpected: number;
  error: { code: string; message: string } | null;
  testMode: boolean;
}

const CALLBACK_ERRORS: Record<string, string> = {
  STATE: "การยืนยันตัวตนหมดอายุ กรุณาเข้าสู่ระบบผู้ดูแลแล้วกดเชื่อมต่อใหม่",
  DENIED: "ไม่ได้รับอนุญาตจากบัญชี Google",
  SCOPE: "ไม่ได้รับสิทธิ์ Google Drive — กรุณาติ๊กอนุญาตสิทธิ์ Drive ในหน้ายินยอมของ Google",
  NOT_CONFIGURED: "ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET",
  OAUTH: "เชื่อมต่อ Google ไม่สำเร็จ — ตรวจสอบ Redirect URI ใน Google Cloud Console ให้ตรงกับ NEXT_PUBLIC_APP_URL/api/admin/drive/callback",
  TOKEN_REVOKED: "Google ปฏิเสธโทเคน กรุณาลองเชื่อมต่อใหม่",
  UNKNOWN: "เกิดข้อผิดพลาดจาก Google กรุณาลองใหม่",
};

export function DriveTab({ settings, save, saving }: { settings: AdminSettings; save: (p: Partial<AdminSettings>) => Promise<boolean>; saving: boolean }) {
  const { data, loading, refresh, refreshing } = useFetch<DriveStatus>("/api/admin/drive/status");
  const [rootId, setRootId] = useState(settings.driveRootFolderId);
  const [rootName, setRootName] = useState(settings.driveRootFolderName);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const err = sp.get("drive_error");
    if (sp.get("drive_connected")) toast.success("เชื่อมต่อ Google Drive สำเร็จ");
    if (err) toast.error(CALLBACK_ERRORS[err] ?? CALLBACK_ERRORS.UNKNOWN, { duration: 10000 });
    if (err || sp.get("drive_connected")) window.history.replaceState(null, "", "/settings?tab=drive");
  }, []);

  const syncFolders = async () => {
    setBusy("folders");
    try {
      const r = await api<{ mapped: number; repaired: number }>("/api/admin/drive/folders", { method: "POST" });
      toast.success(`โครงสร้างโฟลเดอร์พร้อมแล้ว (${r.mapped} โฟลเดอร์${r.repaired ? `, ซ่อม ${r.repaired}` : ""})`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message, { duration: 10000 });
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (!confirm("ยกเลิกการเชื่อมต่อ Google Drive? ไฟล์ที่อัปโหลดแล้วจะยังอยู่ใน Drive แต่จะส่งหลักฐานใหม่และเปิดดูไฟล์ไม่ได้จนกว่าจะเชื่อมต่อใหม่")) return;
    setBusy("disconnect");
    try {
      const r = await api<{ envTokenStillSet: boolean }>("/api/admin/drive/disconnect", { method: "POST" });
      toast.success(r.envTokenStillSet ? "ลบโทเคนในฐานข้อมูลแล้ว (ยังมี GOOGLE_REFRESH_TOKEN ใน Environment)" : "ยกเลิกการเชื่อมต่อแล้ว");
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>สถานะการเชื่อมต่อ Google Drive</CardTitle>
          <Button variant="ghost" size="sm" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? "animate-spin" : ""} /> ตรวจสอบใหม่
          </Button>
        </CardHeader>
        <CardContent>
          {loading && !data ? (
            <Skeleton className="h-32" />
          ) : data ? (
            <div className="grid gap-3 text-sm">
              <div className="flex items-center gap-2" data-testid="drive-status">
                {data.connected ? <CheckCircle2 className="size-5 text-emerald-500" /> : <AlertTriangle className="size-5 text-amber-500" />}
                <span className="font-medium">{data.connected ? `เชื่อมต่อแล้ว: ${data.account}` : "ยังไม่ได้เชื่อมต่อ"}</span>
              </div>
              <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                <dt className="text-muted">ที่มาของโทเคน</dt>
                <dd>{data.tokenSource === "database" ? "ฐานข้อมูล (เข้ารหัส AES-256-GCM)" : data.tokenSource === "env" ? "Environment Variable" : "-"}</dd>
                <dt className="text-muted">ขอบเขตสิทธิ์</dt>
                <dd className="break-all">{data.scope || "-"}</dd>
                <dt className="text-muted">โฟลเดอร์หลัก</dt>
                <dd>{data.rootFolderName ? `${data.rootFolderName} (${data.rootAccessible ? (data.rootWritable ? "เขียนได้" : "อ่านอย่างเดียว") : "เข้าถึงไม่ได้"})` : data.rootFolderId ? "เข้าถึงไม่ได้" : "ยังไม่ได้สร้าง"}</dd>
                <dt className="text-muted">โฟลเดอร์ที่จับคู่แล้ว</dt>
                <dd>
                  {data.foldersMapped} / {data.foldersExpected}
                </dd>
              </dl>
              {data.error && (
                <p className="rounded-xl bg-amber-50 p-3 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200" role="alert">
                  {data.error.message}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                {!data.testMode && (
                  <Button asChild>
                    <a href="/api/admin/drive/connect">
                      <Link2 /> {data.connected ? "เชื่อมต่อใหม่ / เปลี่ยนบัญชี" : "เชื่อมต่อ Google Drive"}
                    </a>
                  </Button>
                )}
                <Button variant="secondary" onClick={syncFolders} disabled={!data.connected || busy !== null}>
                  {busy === "folders" ? <Loader2 className="animate-spin" /> : <FolderTree />} สร้าง/ซ่อมโครงสร้างโฟลเดอร์
                </Button>
                {data.tokenSource === "database" && (
                  <Button variant="ghost" onClick={disconnect} disabled={busy !== null}>
                    <Unplug /> ยกเลิกการเชื่อมต่อ
                  </Button>
                )}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>โฟลเดอร์หลัก (Root Folder)</CardTitle>
          <p className="text-sm text-muted">
            เว้นว่าง Root Folder ID เพื่อให้ระบบสร้างโฟลเดอร์ใหม่ชื่อตามด้านล่างใน My Drive (แนะนำ เหมาะกับสิทธิ์ drive.file) — หากระบุ ID ของโฟลเดอร์ที่สร้างเองนอกระบบ ต้องตั้ง GOOGLE_DRIVE_SCOPE=drive
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="rootName">ชื่อโฟลเดอร์หลัก</Label>
            <Input id="rootName" value={rootName} onChange={(e) => setRootName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="rootId">Root Folder ID</Label>
            <Input id="rootId" value={rootId} placeholder="ปล่อยว่างเพื่อให้ระบบสร้างให้" onChange={(e) => setRootId(e.target.value.trim())} />
          </div>
          <div className="sm:col-span-2">
            <Button
              disabled={saving}
              onClick={async () => {
                if (rootId !== settings.driveRootFolderId && settings.driveRootFolderId && !confirm("เปลี่ยน Root Folder? ไฟล์ใหม่จะถูกเก็บในโฟลเดอร์ใหม่ ไฟล์เดิมยังอยู่ที่เดิม")) return;
                if (await save({ driveRootFolderId: rootId, driveRootFolderName: rootName })) await refresh();
              }}
            >
              <Save /> บันทึก
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
