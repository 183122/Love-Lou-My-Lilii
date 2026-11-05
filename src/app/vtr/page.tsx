"use client";
import { ArrowDown, ArrowUp, Clapperboard, Download, FileJson, FileSpreadsheet, Film, Info, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AccessGate } from "@/components/auth/access-gate";
import { LoadError } from "@/components/dashboard/setup-notice";
import { contentUrl, Thumb } from "@/components/gallery/evidence-gallery";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect, Textarea } from "@/components/ui/form";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/client/api";
import { useFetch } from "@/lib/client/use-fetch";
import { formatBytes } from "@/lib/shared/files";
import { sortVtr } from "@/lib/shared/manifest";
import type { EvidenceItem } from "@/lib/shared/types";

export default function VtrPage() {
  return (
    <>
      <PageHeader title="คัดเลือกภาพและวิดีโอสำหรับ VTR" description="เลือก จัดลำดับ และเขียนหมายเหตุสำหรับผู้ตัดต่อ จากนั้นดาวน์โหลดไฟล์และ Manifest" />
      <AccessGate need="ADMIN">
        <Workspace />
      </AccessGate>
    </>
  );
}

function Workspace() {
  const { data, error, loading, refresh, refreshing, setData } = useFetch<{ items: EvidenceItem[] }>("/api/files");
  const [ind, setInd] = useState("");
  const [type, setType] = useState("");
  const [busy, setBusy] = useState(false);

  const all = useMemo(() => data?.items ?? [], [data]);
  const selected = useMemo(() => sortVtr(all.filter((i) => i.is_vtr_selected)), [all]);
  const candidates = all.filter((i) => !i.is_vtr_selected && (!ind || i.indicator.id === ind) && (!type || i.media_type === type));
  const indicators = useMemo(() => {
    const m = new Map<string, EvidenceItem["indicator"]>();
    all.forEach((i) => m.set(i.indicator.id, i.indicator));
    return [...m.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [all]);

  const patchLocal = (id: string, patch: Partial<EvidenceItem>) =>
    setData((d) => d && { items: d.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) });

  const select = async (it: EvidenceItem, on: boolean) => {
    try {
      const updated = await api<{ vtr_order: number | null }>(`/api/admin/files/${it.id}`, { method: "PATCH", json: { is_vtr_selected: on } });
      patchLocal(it.id, { is_vtr_selected: on, vtr_order: updated.vtr_order });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const move = async (idx: number, dir: -1 | 1) => {
    const order = selected.map((s) => s.id);
    const j = idx + dir;
    if (j < 0 || j >= order.length) return;
    [order[idx], order[j]] = [order[j], order[idx]];
    setData((d) => d && { items: d.items.map((x) => (order.includes(x.id) ? { ...x, vtr_order: order.indexOf(x.id) + 1 } : x)) });
    try {
      await api("/api/admin/vtr/reorder", { method: "POST", json: { ids: order } });
    } catch (e) {
      toast.error((e as Error).message);
      void refresh();
    }
  };

  const saveNote = async (it: EvidenceItem, note: string) => {
    if (note === it.vtr_note) return;
    try {
      await api(`/api/admin/files/${it.id}`, { method: "PATCH", json: { vtr_note: note } });
      patchLocal(it.id, { vtr_note: note });
      toast.success("บันทึกหมายเหตุแล้ว");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const downloadAll = async () => {
    setBusy(true);
    toast.info(`กำลังเริ่มดาวน์โหลด ${selected.length} ไฟล์ทีละไฟล์ — หากเบราว์เซอร์ถาม ให้กด “อนุญาตการดาวน์โหลดหลายไฟล์”`);
    for (const it of selected) {
      const a = document.createElement("a");
      a.href = contentUrl(it.id, true);
      a.download = it.file_name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      await new Promise((r) => setTimeout(r, 1200));
    }
    setBusy(false);
  };

  if (error && !data) return <LoadError error={error} onRetry={refresh} />;
  if (loading && !data) return <Skeleton className="h-96" />;

  const totalBytes = selected.reduce((s, i) => s + i.size_bytes, 0);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>ไฟล์ทั้งหมด ({candidates.length})</CardTitle>
          <Button variant="ghost" size="icon" onClick={refresh} disabled={refreshing} aria-label="รีเฟรช">
            <RefreshCw className={refreshing ? "animate-spin" : ""} />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <NativeSelect value={ind} onChange={(e) => setInd(e.target.value)} aria-label="กรองตามตัวชี้วัด">
              <option value="">ทุกตัวชี้วัด</option>
              {indicators.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} {i.title}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={type} onChange={(e) => setType(e.target.value)} aria-label="กรองตามประเภท">
              <option value="">รูปภาพและวิดีโอ</option>
              <option value="IMAGE">รูปภาพ</option>
              <option value="VIDEO">วิดีโอ</option>
            </NativeSelect>
          </div>
          {candidates.length === 0 ? (
            <EmptyState title="ไม่มีไฟล์ให้เลือก" />
          ) : (
            <div className="grid max-h-[70vh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
              {candidates.map((it) => (
                <div key={it.id} className="overflow-hidden rounded-xl border border-white/70 bg-white/60 dark:border-slate-700 dark:bg-slate-900/40">
                  <div className="relative aspect-video">
                    <Thumb item={it} className="size-full" />
                    {it.media_type === "VIDEO" && <Film className="absolute left-1.5 top-1.5 size-4 text-white drop-shadow" />}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-medium">{it.submission.activity_title}</p>
                    <p className="truncate text-[11px] text-muted">{it.indicator.code} · {it.file_name}</p>
                    <Button size="sm" variant="soft" className="mt-2 w-full" onClick={() => select(it, true)} data-testid="vtr-select">
                      <Plus /> เลือก
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clapperboard className="size-5 text-violet-500" /> รายการที่คัดเลือก ({selected.length})
          </CardTitle>
          <p className="text-sm text-muted">ขนาดรวม {formatBytes(totalBytes)}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" asChild variant="secondary">
              <a href="/api/admin/vtr/manifest?format=csv">
                <FileSpreadsheet /> Manifest (CSV)
              </a>
            </Button>
            <Button size="sm" asChild variant="secondary">
              <a href="/api/admin/vtr/manifest?format=json">
                <FileJson /> Manifest (JSON)
              </a>
            </Button>
            <Button size="sm" onClick={downloadAll} disabled={busy || selected.length === 0}>
              <Download /> ดาวน์โหลดไฟล์ที่เลือก (ทีละไฟล์)
            </Button>
          </div>
          <p className="mt-2 flex gap-1.5 text-xs text-muted">
            <Info className="mt-0.5 size-3.5 shrink-0" />
            ระบบไม่สร้างไฟล์ ZIP บนเซิร์ฟเวอร์ เนื่องจากวิดีโอรวมอาจเกินขีดจำกัดหน่วยความจำ/เวลาของ Serverless Function — ดาวน์โหลดทีละไฟล์แทน หรือเปิดโฟลเดอร์ใน Google Drive แล้วใช้ “ดาวน์โหลด” ของ Drive
          </p>
        </CardHeader>
        <CardContent>
          {selected.length === 0 ? (
            <EmptyState title="ยังไม่ได้คัดเลือกไฟล์" description="กด “เลือก” ที่ไฟล์ทางซ้าย หรือกดดาวในคลังรูปภาพ" />
          ) : (
            <ol className="grid gap-3" data-testid="vtr-selected">
              {selected.map((it, idx) => (
                <li key={it.id} className="flex gap-3 rounded-xl border border-white/70 bg-white/60 p-2.5 dark:border-slate-700 dark:bg-slate-900/40">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg brand-gradient text-xs font-semibold text-white">{idx + 1}</span>
                  <div className="size-16 shrink-0 overflow-hidden rounded-lg">
                    <Thumb item={it} className="size-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.submission.activity_title}</p>
                    <p className="truncate text-xs text-muted">
                      {it.category.code} · {it.indicator.code} · {it.file_name} · {it.media_type === "IMAGE" ? "รูปภาพ" : "วิดีโอ"}
                    </p>
                    <Textarea
                      defaultValue={it.vtr_note}
                      placeholder="หมายเหตุสำหรับผู้ตัดต่อ เช่น ใช้ช่วงวินาทีที่ 10–25"
                      className="mt-1.5 min-h-12 text-xs"
                      onBlur={(e) => saveNote(it, e.target.value)}
                      aria-label="หมายเหตุสำหรับผู้ตัดต่อ"
                    />
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button size="icon" variant="ghost" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="เลื่อนขึ้น">
                      <ArrowUp />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => move(idx, 1)} disabled={idx === selected.length - 1} aria-label="เลื่อนลง">
                      <ArrowDown />
                    </Button>
                    <Button size="icon" variant="ghost" asChild>
                      <a href={contentUrl(it.id, true)} aria-label="ดาวน์โหลด">
                        <Download />
                      </a>
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => select(it, false)} aria-label="ยกเลิกการเลือก">
                      <Trash2 />
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
