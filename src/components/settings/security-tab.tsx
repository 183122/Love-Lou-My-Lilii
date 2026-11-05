"use client";
import { KeyRound, LogOut } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/form";
import { api } from "@/lib/client/api";
import { ToggleRow } from "./general-tab";
import type { AdminSettings, SettingsResponse } from "./use-settings";

export function SecurityTab({
  data,
  save,
  saving,
  reload,
}: {
  data: SettingsResponse;
  save: (p: Partial<AdminSettings>) => Promise<boolean>;
  saving: boolean;
  reload: () => void;
}) {
  const { setSession } = useApp();
  const [code, setCode] = useState("");
  const setViewerCode = async (value: string | null) => {
    try {
      await api("/api/admin/viewer-code", { method: "PUT", json: { code: value } });
      toast.success(value ? "ตั้งรหัสเข้าถึงแล้ว (ผู้ชมเดิมต้องกรอกรหัสใหม่)" : "ปิดรหัสเข้าถึงแล้ว");
      setCode("");
      reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>การป้องกันสแปม</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <ToggleRow
            label="บังคับ CAPTCHA (Cloudflare Turnstile) เมื่อส่งหลักฐาน"
            description={
              data.security.turnstileConfigured
                ? "ตั้งค่า TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY แล้ว"
                : "ยังไม่ได้ตั้งค่า Turnstile keys — หากเปิดไว้ ระบบจะปฏิเสธการส่งจนกว่าจะตั้งค่า"
            }
            checked={data.settings.requireTurnstile}
            disabled={saving}
            onChange={(c) => save({ requireTurnstile: c })}
          />
          <p className="text-xs text-muted">มี Rate Limiting ทุกจุด: เข้าสู่ระบบ 5 ครั้ง/15 นาที, ส่งหลักฐาน 15 ครั้ง/ชั่วโมง ต่อ IP</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>รหัสเข้าถึงสำหรับผู้ชม (อ่านอย่างเดียว)</CardTitle>
          <p className="text-sm text-muted">
            ให้ผู้นิเทศหรือผู้ตัดต่อดู/ดาวน์โหลดหลักฐานได้โดยไม่ต้องเป็นผู้ดูแล — สถานะ: {data.security.viewerCodeEnabled ? "เปิดใช้งาน" : "ปิดอยู่"}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Label htmlFor="viewerCode">รหัสใหม่ (อย่างน้อย 8 ตัวอักษร)</Label>
            <Input id="viewerCode" type="password" autoComplete="new-password" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <Button disabled={code.length < 8} onClick={() => setViewerCode(code)}>
            <KeyRound /> ตั้งรหัส
          </Button>
          {data.security.viewerCodeEnabled && (
            <Button variant="secondary" onClick={() => setViewerCode(null)}>
              ปิดรหัส
            </Button>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>เซสชันผู้ดูแล</CardTitle>
          <p className="text-sm text-muted">
            เซสชันใช้ Cookie แบบ HttpOnly + Secure + SameSite, หมดอายุใน 8 ชั่วโมง, ป้องกัน CSRF ทุกคำขอที่เปลี่ยนแปลงข้อมูล — เปลี่ยนรหัสผ่านผู้ดูแลได้โดยเปลี่ยน ADMIN_PASSWORD_HASH แล้ว Redeploy
          </p>
        </CardHeader>
        <CardContent>
          <Button
            variant="secondary"
            onClick={async () => {
              await api("/api/auth/logout", { method: "POST" }).catch(() => undefined);
              setSession({ role: null });
            }}
          >
            <LogOut /> ออกจากระบบ
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
