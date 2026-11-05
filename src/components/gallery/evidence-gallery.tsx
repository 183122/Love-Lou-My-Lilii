"use client";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Download,
  Film,
  ImageIcon,
  LayoutGrid,
  List,
  RefreshCw,
  Search,
  Star,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LoadError } from "@/components/dashboard/setup-notice";
import { useApp } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/form";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { api } from "@/lib/client/api";
import { useFetch } from "@/lib/client/use-fetch";
import { formatBytes } from "@/lib/shared/files";
import type { EvidenceItem } from "@/lib/shared/types";
import { cn, thDate, thDateTime } from "@/lib/utils";

type Sort = "uploaded_desc" | "uploaded_asc" | "activity_desc" | "name" | "size_desc";

export function contentUrl(id: string, download = false) {
  return `/api/files/${id}/content${download ? "?download=1" : ""}`;
}

export function Thumb({ item, className }: { item: EvidenceItem; className?: string }) {
  const [src, setSrc] = useState(`/api/files/${item.id}/thumbnail`);
  const [failed, setFailed] = useState(false);
  if (failed)
    return (
      <div className={cn("grid place-items-center bg-gradient-to-br from-sky-100 to-violet-100 dark:from-slate-800 dark:to-slate-700", className)}>
        {item.media_type === "VIDEO" ? <Film className="size-8 text-violet-400" /> : <ImageIcon className="size-8 text-sky-400" />}
      </div>
    );
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={item.file_name}
      loading="lazy"
      className={cn("object-cover", className)}
      onError={() => {
        if (item.media_type === "IMAGE" && !src.includes("/content")) setSrc(contentUrl(item.id));
        else setFailed(true);
      }}
    />
  );
}

export function EvidenceGallery({ indicatorId, hideIndicatorFilter }: { indicatorId?: string; hideIndicatorFilter?: boolean }) {
  const { role } = useApp();
  const isAdmin = role === "ADMIN";
  const path = `/api/files${indicatorId ? `?indicator=${indicatorId}` : ""}`;
  const { data, error, loading, refresh, refreshing, setData } = useFetch<{ items: EvidenceItem[] }>(path);
  const [q, setQ] = useState("");
  const [type, setType] = useState<"" | "IMAGE" | "VIDEO">("");
  const [ind, setInd] = useState("");
  const [sort, setSort] = useState<Sort>("uploaded_desc");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState<number | null>(null);

  const indicators = useMemo(() => {
    const m = new Map<string, EvidenceItem["indicator"]>();
    data?.items.forEach((i) => m.set(i.indicator.id, i.indicator));
    return [...m.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [data]);

  const items = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    const out = data.items.filter(
      (i) =>
        (!type || i.media_type === type) &&
        (!ind || i.indicator.id === ind) &&
        (!term ||
          [i.file_name, i.submission.activity_title, i.submission.submitter_name, i.indicator.code, i.indicator.title].some((s) =>
            s.toLowerCase().includes(term),
          )),
    );
    const by: Record<Sort, (a: EvidenceItem, b: EvidenceItem) => number> = {
      uploaded_desc: (a, b) => (b.uploaded_at ?? "").localeCompare(a.uploaded_at ?? ""),
      uploaded_asc: (a, b) => (a.uploaded_at ?? "").localeCompare(b.uploaded_at ?? ""),
      activity_desc: (a, b) => b.submission.activity_date.localeCompare(a.submission.activity_date),
      name: (a, b) => a.file_name.localeCompare(b.file_name, "th"),
      size_desc: (a, b) => b.size_bytes - a.size_bytes,
    };
    return out.sort(by[sort]);
  }, [data, q, type, ind, sort]);

  const toggleVtr = async (it: EvidenceItem) => {
    try {
      await api(`/api/admin/files/${it.id}`, { method: "PATCH", json: { is_vtr_selected: !it.is_vtr_selected } });
      setData((d) => d && { items: d.items.map((x) => (x.id === it.id ? { ...x, is_vtr_selected: !x.is_vtr_selected } : x)) });
      toast.success(it.is_vtr_selected ? "ยกเลิกการเลือกสำหรับ VTR แล้ว" : "เพิ่มในรายการ VTR แล้ว");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  if (error && !data) return <LoadError error={error} onRetry={refresh} />;
  if (loading && !data)
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square" />
        ))}
      </div>
    );

  return (
    <div>
      <div className="mb-4 grid gap-2 md:grid-cols-[1fr_auto_auto_auto_auto]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input className="pl-9" placeholder="ค้นหาชื่อกิจกรรม ผู้ส่ง ชื่อไฟล์" value={q} onChange={(e) => setQ(e.target.value)} aria-label="ค้นหาหลักฐาน" />
        </div>
        <NativeSelect value={type} onChange={(e) => setType(e.target.value as typeof type)} aria-label="ประเภทไฟล์">
          <option value="">ทุกประเภท</option>
          <option value="IMAGE">รูปภาพ</option>
          <option value="VIDEO">วิดีโอ</option>
        </NativeSelect>
        {!hideIndicatorFilter && (
          <NativeSelect value={ind} onChange={(e) => setInd(e.target.value)} aria-label="ตัวชี้วัด" className="md:max-w-56">
            <option value="">ทุกตัวชี้วัด</option>
            {indicators.map((i) => (
              <option key={i.id} value={i.id}>
                {i.code} {i.title}
              </option>
            ))}
          </NativeSelect>
        )}
        <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="เรียงลำดับ">
          <option value="uploaded_desc">ส่งล่าสุด</option>
          <option value="uploaded_asc">ส่งก่อน</option>
          <option value="activity_desc">วันที่กิจกรรม</option>
          <option value="name">ชื่อไฟล์</option>
          <option value="size_desc">ขนาดใหญ่สุด</option>
        </NativeSelect>
        <div className="flex gap-1">
          <Button variant={view === "grid" ? "soft" : "ghost"} size="icon" onClick={() => setView("grid")} aria-label="มุมมองตาราง">
            <LayoutGrid />
          </Button>
          <Button variant={view === "list" ? "soft" : "ghost"} size="icon" onClick={() => setView("list")} aria-label="มุมมองรายการ">
            <List />
          </Button>
          <Button variant="ghost" size="icon" onClick={refresh} disabled={refreshing} aria-label="รีเฟรช">
            <RefreshCw className={refreshing ? "animate-spin" : ""} />
          </Button>
        </div>
      </div>
      <p className="mb-3 text-sm text-muted" data-testid="gallery-count">
        {items.length} ไฟล์ · รูปภาพ {items.filter((i) => i.media_type === "IMAGE").length} · วิดีโอ {items.filter((i) => i.media_type === "VIDEO").length}
      </p>

      {items.length === 0 ? (
        <Card>
          <EmptyState title="ยังไม่มีหลักฐาน" description="เมื่อมีการอัปโหลดไฟล์สำเร็จ หลักฐานจะแสดงที่นี่" />
        </Card>
      ) : view === "grid" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((it, idx) => (
            <Card key={it.id} className="group overflow-hidden">
              <button className="relative block aspect-square w-full" onClick={() => setOpen(idx)} aria-label={`เปิดดู ${it.file_name}`} data-testid="gallery-item">
                <Thumb item={it} className="size-full transition group-hover:scale-105" />
                {it.media_type === "VIDEO" && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white">
                    <Film className="size-3" /> วิดีโอ
                  </span>
                )}
                {it.is_vtr_selected && (
                  <span className="absolute right-2 top-2 rounded-full bg-violet-500 p-1 text-white" title="คัดเลือกสำหรับ VTR">
                    <Star className="size-3" fill="currentColor" />
                  </span>
                )}
              </button>
              <div className="p-3">
                <p className="truncate text-sm font-medium">{it.submission.activity_title}</p>
                <p className="truncate text-xs text-muted">
                  {it.indicator.code} · {it.submission.submitter_name}
                </p>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="divide-y divide-slate-200/60 dark:divide-slate-700/50">
          {items.map((it, idx) => (
            <div key={it.id} className="flex items-center gap-3 p-3">
              <button onClick={() => setOpen(idx)} className="size-16 shrink-0 overflow-hidden rounded-xl" aria-label={`เปิดดู ${it.file_name}`}>
                <Thumb item={it} className="size-full" />
              </button>
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">{it.submission.activity_title}</p>
                <p className="truncate text-xs text-muted">
                  {it.indicator.code} {it.indicator.title}
                </p>
                <p className="truncate text-xs text-muted">
                  {it.file_name} · {formatBytes(it.size_bytes)} · {it.mime_type} · โดย {it.submission.submitter_name} · กิจกรรม {thDate(it.submission.activity_date)} · ส่ง {thDateTime(it.uploaded_at)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                {isAdmin && (
                  <Button size="icon" variant={it.is_vtr_selected ? "soft" : "ghost"} onClick={() => toggleVtr(it)} aria-label="เลือกสำหรับ VTR">
                    <Star fill={it.is_vtr_selected ? "currentColor" : "none"} />
                  </Button>
                )}
                <Button size="icon" variant="ghost" asChild>
                  <a href={contentUrl(it.id, true)} aria-label={`ดาวน์โหลด ${it.file_name}`}>
                    <Download />
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}

      <Lightbox items={items} index={open} onIndex={setOpen} isAdmin={isAdmin} onToggleVtr={toggleVtr} />
    </div>
  );
}

function Lightbox({
  items,
  index,
  onIndex,
  isAdmin,
  onToggleVtr,
}: {
  items: EvidenceItem[];
  index: number | null;
  onIndex: (i: number | null) => void;
  isAdmin: boolean;
  onToggleVtr: (it: EvidenceItem) => void;
}) {
  const it = index !== null ? items[index] : null;
  const [videoErrorId, setVideoErrorId] = useState<string | null>(null);
  const videoError = it !== null && videoErrorId === it.id;

  useEffect(() => {
    if (index === null) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && index < items.length - 1) onIndex(index + 1);
      if (e.key === "ArrowLeft" && index > 0) onIndex(index - 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [index, items.length, onIndex]);

  return (
    <DialogPrimitive.Root open={it !== null} onOpenChange={(o) => !o && onIndex(null)}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur" />
        <DialogPrimitive.Content className="fixed inset-0 z-50 flex flex-col p-3 text-white sm:p-6" data-testid="lightbox">
          {it && (
            <>
              <div className="mb-3 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <DialogPrimitive.Title className="truncate font-semibold">{it.submission.activity_title}</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="truncate text-xs text-white/70">
                    {it.indicator.code} {it.indicator.title}
                  </DialogPrimitive.Description>
                </div>
                {isAdmin && (
                  <Button size="sm" variant={it.is_vtr_selected ? "primary" : "secondary"} onClick={() => onToggleVtr(it)}>
                    <Clapperboard /> {it.is_vtr_selected ? "เลือกแล้ว" : "เลือกสำหรับ VTR"}
                  </Button>
                )}
                <Button size="sm" variant="secondary" asChild>
                  <a href={contentUrl(it.id, true)}>
                    <Download /> <span className="hidden sm:inline">ดาวน์โหลด</span>
                  </a>
                </Button>
                <DialogPrimitive.Close className="rounded-lg p-1.5 hover:bg-white/10" aria-label="ปิด">
                  <X className="size-6" />
                </DialogPrimitive.Close>
              </div>
              <div className="relative flex min-h-0 flex-1 items-center justify-center">
                {index! > 0 && (
                  <button className="absolute left-0 z-10 rounded-full bg-white/10 p-2 hover:bg-white/20" onClick={() => onIndex(index! - 1)} aria-label="ก่อนหน้า">
                    <ChevronLeft className="size-6" />
                  </button>
                )}
                {it.media_type === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={contentUrl(it.id)} alt={it.file_name} className="max-h-full max-w-full rounded-xl object-contain" data-testid="lightbox-image" />
                ) : videoError ? (
                  <div className="max-w-md rounded-2xl bg-white/10 p-6 text-center text-sm">
                    <Film className="mx-auto mb-3 size-10 text-white/70" />
                    <p className="font-medium">เบราว์เซอร์นี้ไม่สามารถเล่นวิดีโอนี้ได้โดยตรง</p>
                    <p className="mt-1 text-white/70">อาจเป็นรูปแบบที่ไม่รองรับ (เช่น MOV/HEVC บางรุ่น) หรือไฟล์ถูกลบจาก Google Drive — กดดาวน์โหลดเพื่อเปิดด้วยโปรแกรมในเครื่อง</p>
                    <Button className="mt-4" asChild>
                      <a href={contentUrl(it.id, true)}>
                        <Download /> ดาวน์โหลดวิดีโอ
                      </a>
                    </Button>
                  </div>
                ) : (
                  <video
                    key={it.id}
                    src={contentUrl(it.id)}
                    controls
                    playsInline
                    preload="metadata"
                    className="max-h-full max-w-full rounded-xl"
                    onError={() => setVideoErrorId(it.id)}
                    data-testid="lightbox-video"
                  />
                )}
                {index! < items.length - 1 && (
                  <button className="absolute right-0 z-10 rounded-full bg-white/10 p-2 hover:bg-white/20" onClick={() => onIndex(index! + 1)} aria-label="ถัดไป">
                    <ChevronRight className="size-6" />
                  </button>
                )}
              </div>
              <div className="mt-3 grid gap-x-6 gap-y-1 text-xs text-white/80 sm:grid-cols-2 lg:grid-cols-4">
                <p>ผู้ส่ง: {it.submission.submitter_name} ({it.submission.submitter_position})</p>
                <p>วันที่กิจกรรม: {thDate(it.submission.activity_date)}</p>
                <p>วันที่ส่ง: {thDateTime(it.uploaded_at)}</p>
                <p className="truncate">
                  ไฟล์: {it.file_name} · {formatBytes(it.size_bytes)} · {it.mime_type}
                </p>
                {it.submission.activity_detail && <p className="sm:col-span-2 lg:col-span-4">รายละเอียด: {it.submission.activity_detail}</p>}
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
