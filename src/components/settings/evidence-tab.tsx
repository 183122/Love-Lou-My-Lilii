"use client";
import { AlertTriangle, Download, Loader2, RefreshCw, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { contentUrl } from "@/components/gallery/evidence-gallery";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/form";
import { Badge, EmptyState, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/client/api";
import { useFetch } from "@/lib/client/use-fetch";
import { formatBytes } from "@/lib/shared/files";
import type { EvidenceItem, FileStatus } from "@/lib/shared/types";
import { thDateTime } from "@/lib/utils";

const STATUS: Record<FileStatus, [string, string]> = {
  UPLOADED: ["อัปโหลดสำเร็จ", "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"],
  UPLOADING: ["กำลังอัปโหลด/ค้าง", "bg-sky-100 text-sky-700"],
  PENDING: ["ยังไม่เริ่ม", "bg-slate-100 text-slate-600"],
  FAILED: ["ล้มเหลว", "bg-rose-100 text-rose-700"],
  MISSING: ["ไม่พบใน Drive", "bg-amber-100 text-amber-700"],
  DELETED: ["ลบแล้ว", "bg-slate-100 text-slate-500"],
};

export function EvidenceTab() {
  const { data, loading, refresh, refreshing } = useFetch<{ items: EvidenceItem[] }>("/api/admin/files");
  const [status, setStatus] = useState("");
  const [target, setTarget] = useState<EvidenceItem | null>(null);
  const [mode, setMode] = useState<"database" | "drive">("database");
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const verify = async () => {
    setVerifying(true);
    try {
      const r = await api<{ checked: number; missing: number }>("/api/admin/files/verify", { method: "POST" });
      toast.success(`ตรวจสอบ ${r.checked} ไฟล์ · ไม่พบใน Drive ${r.missing} ไฟล์ (ไม่นับในความคืบหน้า)`);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setVerifying(false);
    }
  };

  const doDelete = async () => {
    if (!target) return;
    setBusy(true);
    try {
      await api(`/api/admin/files/${target.id}`, { method: "DELETE", json: { mode, confirm: true } });
      toast.success(mode === "drive" ? "ลบรายการและย้ายไฟล์ใน Drive ไปถังขยะแล้ว" : "ลบรายการในระบบแล้ว (ไฟล์ใน Drive ยังอยู่)");
      setTarget(null);
      await refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading || !data) return <Skeleton className="h-96" />;
  const items = data.items.filter((i) => !status || i.status === status);

  return (
    <Card>
      <CardHeader>
        <CardTitle>จัดการหลักฐาน ({data.items.length} ไฟล์)</CardTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-auto" aria-label="กรองสถานะ">
            <option value="">ทุกสถานะ</option>
            {Object.entries(STATUS).map(([k, [l]]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </NativeSelect>
          <Button size="sm" variant="secondary" onClick={verify} disabled={verifying}>
            {verifying ? <Loader2 className="animate-spin" /> : <ShieldCheck />} ตรวจสอบไฟล์กับ Google Drive
          </Button>
          <Button size="sm" variant="ghost" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? "animate-spin" : ""} /> รีเฟรช
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState title="ไม่มีไฟล์" />
        ) : (
          <div className="divide-y divide-slate-200/60 dark:divide-slate-700/50">
            {items.map((it) => (
              <div key={it.id} className="flex flex-wrap items-center gap-2 py-2.5 sm:flex-nowrap" data-testid="admin-file-row">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate font-medium">{it.file_name}</p>
                  <p className="truncate text-xs text-muted">
                    {it.indicator.code} · {it.submission.activity_title} · {it.submission.submitter_name} · {formatBytes(it.size_bytes)} · {thDateTime(it.created_at)}
                  </p>
                </div>
                <Badge className={STATUS[it.status][1]}>{STATUS[it.status][0]}</Badge>
                {it.status === "UPLOADED" && (
                  <Button size="icon" variant="ghost" asChild>
                    <a href={contentUrl(it.id, true)} aria-label="ดาวน์โหลด">
                      <Download />
                    </a>
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => { setMode("database"); setTarget(it); }} aria-label={`ลบ ${it.file_name}`}>
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        {target && (
          <DialogContent title="ยืนยันการลบหลักฐาน" description={target.file_name}>
            <div className="grid gap-3 text-sm">
              <label className="flex gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <input type="radio" name="mode" checked={mode === "database"} onChange={() => setMode("database")} />
                <span>
                  <span className="font-medium">ลบเฉพาะรายการในระบบ</span>
                  <span className="block text-muted">ไฟล์ยังอยู่ใน Google Drive ตามเดิม แต่จะไม่แสดงในระบบและไม่นับในความคืบหน้า</span>
                </span>
              </label>
              <label className="flex gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                <input type="radio" name="mode" checked={mode === "drive"} onChange={() => setMode("drive")} />
                <span>
                  <span className="font-medium">ลบรายการ และย้ายไฟล์ใน Google Drive ไปถังขยะ</span>
                  <span className="block text-muted">กู้คืนได้จากถังขยะของ Google Drive ภายใน 30 วัน</span>
                </span>
              </label>
              <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="size-4 shrink-0" />
                ผลกระทบ: ตัวชี้วัด {target.indicator.code} จะถูกคำนวณสถานะใหม่ทันที{target.is_vtr_selected ? " และไฟล์จะถูกนำออกจากรายการ VTR" : ""} — การลบรายการในระบบย้อนกลับไม่ได้
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setTarget(null)}>
                  ยกเลิก
                </Button>
                <Button variant="danger" onClick={doDelete} disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />} ยืนยันการลบ
                </Button>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  );
}
