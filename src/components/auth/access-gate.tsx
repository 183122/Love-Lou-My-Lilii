"use client";
import { KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FieldError, Input, Label } from "@/components/ui/form";
import { Skeleton } from "@/components/ui/misc";
import { api, ApiError } from "@/lib/client/api";
import type { SessionRole } from "@/lib/shared/types";

/** Renders children only for sessions with the required role; otherwise shows the login / access-code form. */
export function AccessGate({ need, children }: { need: SessionRole; children: React.ReactNode }) {
  const { role, sessionLoaded } = useApp();
  if (!sessionLoaded) return <Skeleton className="h-64" />;
  const ok = need === "VIEWER" ? role === "VIEWER" || role === "ADMIN" : role === "ADMIN";
  if (ok) return <>{children}</>;
  return <LoginCard need={need} />;
}

export function LoginCard({ need }: { need: SessionRole }) {
  const { setSession } = useApp();
  const [mode, setMode] = useState<SessionRole>(need);
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const s =
        mode === "ADMIN"
          ? await api<{ role: SessionRole; csrfToken: string }>("/api/auth/login", { method: "POST", json: { password: secret } })
          : await api<{ role: SessionRole; csrfToken: string }>("/api/auth/viewer", { method: "POST", json: { code: secret } });
      setSession(s);
      toast.success(mode === "ADMIN" ? "เข้าสู่ระบบผู้ดูแลแล้ว" : "เข้าถึงคลังหลักฐานแล้ว");
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : String(e2));
    } finally {
      setBusy(false);
      setSecret("");
    }
  };

  return (
    <Card className="mx-auto mt-6 max-w-md p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl brand-gradient text-white">
          {mode === "ADMIN" ? <ShieldCheck className="size-5" /> : <KeyRound className="size-5" />}
        </span>
        <div>
          <p className="font-semibold">{mode === "ADMIN" ? "เข้าสู่ระบบผู้ดูแล" : "กรอกรหัสเข้าถึงคลังหลักฐาน"}</p>
          <p className="text-sm text-muted">
            {mode === "ADMIN" ? "สำหรับจัดการตัวชี้วัด ไฟล์ การคัดเลือก VTR และ Google Drive" : "รหัสแบบอ่านอย่างเดียว ใช้ดูและดาวน์โหลดหลักฐาน"}
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="grid gap-3">
        <div>
          <Label htmlFor="secret">{mode === "ADMIN" ? "รหัสผ่านผู้ดูแล" : "รหัสเข้าถึง"}</Label>
          <Input id="secret" type="password" autoComplete={mode === "ADMIN" ? "current-password" : "off"} value={secret} onChange={(e) => setSecret(e.target.value)} required />
          <FieldError>{err}</FieldError>
        </div>
        <Button type="submit" disabled={busy || !secret}>
          {busy && <Loader2 className="animate-spin" />}
          {mode === "ADMIN" ? "เข้าสู่ระบบ" : "เข้าถึงคลังหลักฐาน"}
        </Button>
        {need === "VIEWER" && (
          <button type="button" className="text-sm text-violet-600 hover:underline dark:text-violet-300" onClick={() => setMode(mode === "ADMIN" ? "VIEWER" : "ADMIN")}>
            {mode === "ADMIN" ? "ใช้รหัสเข้าถึงแบบอ่านอย่างเดียว" : "เข้าสู่ระบบในฐานะผู้ดูแล"}
          </button>
        )}
      </form>
    </Card>
  );
}
