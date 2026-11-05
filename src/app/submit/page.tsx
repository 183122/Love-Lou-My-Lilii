"use client";
import { AnimatePresence, motion } from "framer-motion";
import {
  Camera,
  CheckCircle2,
  Film,
  ImageIcon,
  Loader2,
  RotateCcw,
  Send,
  Trash2,
  UploadCloud,
  Video,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useApp } from "@/components/providers";
import { Turnstile } from "@/components/submit/turnstile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError, Input, Label, NativeSelect, Textarea } from "@/components/ui/form";
import { ErrorBox, PageHeader, Progress, Skeleton } from "@/components/ui/misc";
import { api, ApiError } from "@/lib/client/api";
import { newClientUploadId, uploadFile, UploadError } from "@/lib/client/uploader";
import { useFetch } from "@/lib/client/use-fetch";
import { checkFileMeta, formatBytes } from "@/lib/shared/files";
import type { Category, Indicator, MediaType } from "@/lib/shared/types";
import { cn } from "@/lib/utils";

type ItemStatus = "ready" | "invalid" | "queued" | "uploading" | "done" | "failed";

interface Item {
  clientUploadId: string;
  file: File;
  previewUrl: string;
  mediaType: MediaType | null;
  status: ItemStatus;
  progress: number;
  error?: string;
  serverId?: string;
  token?: string;
}

interface CreatedSubmission {
  submissionId: string;
  chunkSize: number;
  files: { id: string; clientUploadId: string; uploadToken: string; status: string }[];
}

const today = () => new Date().toLocaleDateString("sv-SE");

export default function SubmitPage() {
  const { config } = useApp();
  const { data, error, loading, refresh } = useFetch<{ categories: Category[]; indicators: Indicator[] }>("/api/indicators");

  const [categoryId, setCategoryId] = useState("");
  const [indicatorId, setIndicatorId] = useState("");
  const [form, setForm] = useState({
    submitterName: "",
    submitterPosition: "",
    activityTitle: "",
    activityDetail: "",
    activityDate: today(),
    note: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [items, setItems] = useState<Item[]>([]);
  const [phase, setPhase] = useState<"form" | "uploading" | "finished">("form");
  const [submission, setSubmission] = useState<CreatedSubmission | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileReset, setTurnstileReset] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Preselect from ?indicator=<id>
  useEffect(() => {
    if (!data) return;
    const id = new URLSearchParams(window.location.search).get("indicator");
    const ind = data.indicators.find((i) => i.id === id);
    if (ind) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time preselect from URL after data loads
      setCategoryId(ind.category_id);
      setIndicatorId(ind.id);
    }
  }, [data]);

  // Revoke preview URLs on unmount
  useEffect(() => () => itemsRef.current.forEach((i) => URL.revokeObjectURL(i.previewUrl)), []);

  // Warn before leaving during upload
  useEffect(() => {
    if (phase !== "uploading") return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [phase]);

  const indicators = useMemo(
    () => (data?.indicators ?? []).filter((i) => i.category_id === categoryId),
    [data, categoryId],
  );
  const indicator = data?.indicators.find((i) => i.id === indicatorId);
  const limits = config?.limits;

  const addFiles = (list: FileList | File[] | null) => {
    if (!list || !limits) return;
    const incoming = Array.from(list);
    setItems((prev) => {
      const next = [...prev];
      for (const file of incoming) {
        if (next.some((x) => x.file.name === file.name && x.file.size === file.size && x.file.lastModified === file.lastModified)) continue;
        if (next.length >= limits.maxFiles) {
          toast.error(`แนบได้ไม่เกิน ${limits.maxFiles} ไฟล์ต่อการส่ง`);
          break;
        }
        const r = checkFileMeta({ name: file.name, size: file.size, type: file.type }, limits);
        next.push({
          clientUploadId: newClientUploadId(),
          file,
          previewUrl: URL.createObjectURL(file),
          mediaType: r.ok ? r.mediaType : null,
          status: r.ok ? "ready" : "invalid",
          progress: 0,
          error: r.ok ? undefined : r.error,
        });
      }
      return next;
    });
  };

  const removeItem = (id: string) =>
    setItems((prev) => {
      const it = prev.find((x) => x.clientUploadId === id);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((x) => x.clientUploadId !== id);
    });

  const patchItem = (id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((x) => (x.clientUploadId === id ? { ...x, ...patch } : x)));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!categoryId) e.category = "กรุณาเลือกหมวดการนิเทศ";
    if (!indicatorId) e.indicator = "กรุณาเลือกตัวชี้วัด";
    if (!form.submitterName.trim()) e.submitterName = "กรุณากรอกชื่อผู้ส่ง";
    if (!form.submitterPosition.trim()) e.submitterPosition = "กรุณากรอกตำแหน่ง";
    if (!form.activityTitle.trim()) e.activityTitle = "กรุณากรอกชื่อกิจกรรม";
    if (!form.activityDate) e.activityDate = "กรุณาระบุวันที่จัดกิจกรรม";
    const valid = items.filter((i) => i.status !== "invalid");
    if (valid.length === 0) e.files = "กรุณาแนบรูปภาพหรือวิดีโออย่างน้อย 1 ไฟล์";
    if (items.some((i) => i.status === "invalid")) e.files = "มีไฟล์ที่ไม่ผ่านการตรวจสอบ กรุณานำออกก่อนส่ง";
    if (config?.turnstileSiteKey && !turnstileToken) e.captcha = "กรุณายืนยันว่าไม่ใช่บอท";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const runUpload = async (it: Item, target: { id: string; uploadToken: string }, chunkSize: number) => {
    patchItem(it.clientUploadId, { status: "uploading", error: undefined, serverId: target.id, token: target.uploadToken });
    try {
      await uploadFile(it.file, target, chunkSize, (sent, total) =>
        patchItem(it.clientUploadId, { progress: total ? Math.round((sent / total) * 100) : 0 }),
      );
      patchItem(it.clientUploadId, { status: "done", progress: 100 });
      return true;
    } catch (e) {
      patchItem(it.clientUploadId, { status: "failed", error: e instanceof Error ? e.message : String(e) });
      return false;
    }
  };

  const uploadAll = async (sub: CreatedSubmission, list: Item[]) => {
    setPhase("uploading");
    const queue = list.filter((i) => i.status !== "done" && i.status !== "invalid");
    queue.forEach((i) => patchItem(i.clientUploadId, { status: "queued" }));
    // Two parallel uploads: good throughput on school Wi-Fi without overloading mobile data.
    let ok = 0;
    const work = async () => {
      while (queue.length) {
        const it = queue.shift()!;
        const target = sub.files.find((f) => f.clientUploadId === it.clientUploadId)!;
        if (await runUpload(it, target, sub.chunkSize)) ok++;
      }
    };
    await Promise.all([work(), work()]);
    setPhase("finished");
    const failed = itemsRef.current.filter((i) => i.status === "failed").length;
    if (failed === 0) toast.success("ส่งหลักฐานสำเร็จ ไฟล์ทั้งหมดถูกจัดเก็บใน Google Drive แล้ว");
    else toast.error(`อัปโหลดไม่สำเร็จ ${failed} ไฟล์ — กด “ลองใหม่” ที่ไฟล์นั้น`);
    return ok;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!validate()) {
      toast.error("กรุณาตรวจสอบข้อมูลให้ครบถ้วน");
      return;
    }
    const valid = items.filter((i) => i.status !== "invalid");
    setPhase("uploading");
    try {
      const sub = await api<CreatedSubmission>("/api/submissions", {
        method: "POST",
        json: {
          indicatorId,
          ...form,
          turnstileToken: turnstileToken ?? undefined,
          files: valid.map((i) => ({ clientUploadId: i.clientUploadId, name: i.file.name, size: i.file.size, type: i.file.type })),
        },
      });
      setSubmission(sub);
      setTurnstileToken(null);
      setTurnstileReset((n) => n + 1);
      await uploadAll(sub, valid);
    } catch (err) {
      setPhase("form");
      setTurnstileToken(null);
      setTurnstileReset((n) => n + 1);
      const msg = err instanceof ApiError ? err.message : String(err);
      setFormError(msg);
      toast.error(msg);
    }
  };

  const retry = async (it: Item) => {
    if (!submission || !it.serverId || !it.token) return;
    setPhase("uploading");
    const ok = await runUpload(it, { id: it.serverId, uploadToken: it.token }, submission.chunkSize);
    setPhase("finished");
    if (ok) toast.success(`อัปโหลด "${it.file.name}" สำเร็จ`);
  };

  const resetAll = () => {
    items.forEach((i) => URL.revokeObjectURL(i.previewUrl));
    setItems([]);
    setSubmission(null);
    setPhase("form");
    setForm((f) => ({ ...f, activityTitle: "", activityDetail: "", note: "" }));
  };

  const locked = phase !== "form";
  const doneCount = items.filter((i) => i.status === "done").length;
  const accept = (limits?.allowedMime ?? []).join(",");
  const imgAccept = (limits?.allowedMime ?? []).filter((m) => m.startsWith("image/")).join(",");
  const vidAccept = (limits?.allowedMime ?? []).filter((m) => m.startsWith("video/")).join(",");

  if (error && !data) return <ErrorBox message={error.message} onRetry={refresh} />;
  if (loading || !data || !config) return <Skeleton className="h-[36rem]" />;

  return (
    <>
      <PageHeader title="ส่งหลักฐาน" description="ส่งภาพและวิดีโอประกอบการนิเทศ — ไม่ต้องเข้าสู่ระบบ ไฟล์จะถูกจัดเก็บใน Google Drive ตามตัวชี้วัด" />
      <form onSubmit={onSubmit} noValidate className="grid gap-4 lg:grid-cols-5 lg:gap-6">
        <div className="grid content-start gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>1. เลือกตัวชี้วัด</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div>
                <Label htmlFor="category">หมวดการนิเทศ *</Label>
                <NativeSelect
                  id="category"
                  value={categoryId}
                  disabled={locked}
                  onChange={(e) => {
                    setCategoryId(e.target.value);
                    setIndicatorId("");
                  }}
                >
                  <option value="">— เลือกหมวด —</option>
                  {data.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}. {c.name}
                    </option>
                  ))}
                </NativeSelect>
                <FieldError>{errors.category}</FieldError>
              </div>
              <div>
                <Label htmlFor="indicator">ตัวชี้วัด *</Label>
                <NativeSelect id="indicator" value={indicatorId} disabled={locked || !categoryId} onChange={(e) => setIndicatorId(e.target.value)}>
                  <option value="">{categoryId ? "— เลือกตัวชี้วัด —" : "เลือกหมวดก่อน"}</option>
                  {indicators.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.code} {i.title}
                    </option>
                  ))}
                </NativeSelect>
                <FieldError>{errors.indicator}</FieldError>
              </div>
              {indicator && (
                <div className="rounded-xl bg-gradient-to-br from-sky-50 to-violet-50 p-3 text-sm dark:from-sky-500/10 dark:to-violet-500/10">
                  <p className="font-medium">หลักฐานที่แนะนำ</p>
                  <p className="mt-1 text-muted">{indicator.recommended_evidence || "-"}</p>
                  <p className="mt-2 text-xs">
                    เกณฑ์ขั้นต่ำ: รูปภาพ {indicator.required_image_count} ไฟล์ · วิดีโอ {indicator.required_video_count} ไฟล์
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. ข้อมูลผู้ส่งและกิจกรรม</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div>
                  <Label htmlFor="submitterName">ชื่อผู้ส่ง *</Label>
                  <Input id="submitterName" autoComplete="name" disabled={locked} value={form.submitterName} maxLength={150} onChange={(e) => setForm({ ...form, submitterName: e.target.value })} />
                  <FieldError>{errors.submitterName}</FieldError>
                </div>
                <div>
                  <Label htmlFor="submitterPosition">ตำแหน่ง *</Label>
                  <Input id="submitterPosition" disabled={locked} value={form.submitterPosition} maxLength={150} placeholder="เช่น ครู, ครูผู้ช่วย" onChange={(e) => setForm({ ...form, submitterPosition: e.target.value })} />
                  <FieldError>{errors.submitterPosition}</FieldError>
                </div>
              </div>
              <div>
                <Label htmlFor="activityTitle">ชื่อกิจกรรม *</Label>
                <Input id="activityTitle" disabled={locked} value={form.activityTitle} maxLength={300} onChange={(e) => setForm({ ...form, activityTitle: e.target.value })} />
                <FieldError>{errors.activityTitle}</FieldError>
              </div>
              <div>
                <Label htmlFor="activityDetail">รายละเอียดกิจกรรม</Label>
                <Textarea id="activityDetail" disabled={locked} value={form.activityDetail} maxLength={5000} onChange={(e) => setForm({ ...form, activityDetail: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="activityDate">วันที่จัดกิจกรรม *</Label>
                <Input id="activityDate" type="date" disabled={locked} value={form.activityDate} onChange={(e) => setForm({ ...form, activityDate: e.target.value })} />
                <FieldError>{errors.activityDate}</FieldError>
              </div>
              <div>
                <Label htmlFor="note">หมายเหตุ</Label>
                <Textarea id="note" disabled={locked} value={form.note} maxLength={2000} className="min-h-16" onChange={(e) => setForm({ ...form, note: e.target.value })} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid content-start gap-4 lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>3. แนบรูปภาพและวิดีโอ</CardTitle>
              <p className="text-sm text-muted">
                JPG, JPEG, PNG, WEBP ไม่เกิน {formatBytes(config.limits.maxImageBytes)} · MP4, MOV, WEBM ไม่เกิน {formatBytes(config.limits.maxVideoBytes)} · สูงสุด {config.limits.maxFiles} ไฟล์
              </p>
            </CardHeader>
            <CardContent className="grid gap-4">
              {!locked && (
                <>
                  <label
                    htmlFor="file-input"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragOver(false);
                      addFiles(e.dataTransfer.files);
                    }}
                    className={cn(
                      "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition",
                      dragOver ? "border-violet-400 bg-violet-50 dark:bg-violet-500/10" : "border-sky-200 hover:border-violet-300 hover:bg-white/60 dark:border-slate-700 dark:hover:bg-slate-800/40",
                    )}
                  >
                    <UploadCloud className="size-10 text-violet-400" />
                    <span className="font-medium">ลากไฟล์มาวางที่นี่ หรือแตะเพื่อเลือกไฟล์</span>
                    <span className="text-xs text-muted">เลือกได้หลายไฟล์พร้อมกัน</span>
                    <input id="file-input" data-testid="file-input" type="file" multiple accept={accept} className="sr-only" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <PickerButton icon={<ImageIcon />} label="เลือกรูปภาพ" accept={imgAccept} multiple onFiles={addFiles} />
                    <PickerButton icon={<Video />} label="เลือกวิดีโอ" accept={vidAccept} multiple onFiles={addFiles} />
                    <PickerButton icon={<Camera />} label="ถ่ายภาพ" accept="image/*" capture="environment" onFiles={addFiles} />
                    <PickerButton icon={<Film />} label="ถ่ายวิดีโอ" accept="video/*" capture="environment" onFiles={addFiles} />
                  </div>
                </>
              )}
              <FieldError>{errors.files}</FieldError>

              <AnimatePresence initial={false}>
                {items.map((it) => (
                  <motion.div key={it.clientUploadId} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }}>
                    <FileCard item={it} canRemove={!locked} canRetry={phase === "finished" && it.status === "failed"} onRemove={() => removeItem(it.clientUploadId)} onRetry={() => retry(it)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </CardContent>
          </Card>

          {config.turnstileSiteKey && phase === "form" && (
            <Card className="p-4">
              <Turnstile siteKey={config.turnstileSiteKey} onToken={setTurnstileToken} resetKey={turnstileReset} />
              <FieldError>{errors.captcha}</FieldError>
            </Card>
          )}

          {formError && <ErrorBox message={formError} />}

          {phase === "finished" ? (
            <Card className="p-5">
              <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:text-left">
                {doneCount === items.length ? <CheckCircle2 className="size-10 text-emerald-500" /> : <XCircle className="size-10 text-amber-500" />}
                <div className="flex-1">
                  <p className="font-semibold" data-testid="upload-summary">
                    อัปโหลดสำเร็จ {doneCount} จาก {items.length} ไฟล์
                  </p>
                  <p className="text-sm text-muted">
                    {doneCount === items.length ? "บันทึก File ID จาก Google Drive แล้ว Dashboard จะอัปเดตอัตโนมัติ" : "ไฟล์ที่ไม่สำเร็จจะไม่ถูกนับในความคืบหน้า กด “ลองใหม่” เพื่ออัปโหลดต่อ"}
                  </p>
                </div>
                <div className="flex gap-2">
                  {indicator && (
                    <Button variant="secondary" asChild>
                      <Link href={`/indicators/${indicator.id}`}>ดูตัวชี้วัด</Link>
                    </Button>
                  )}
                  <Button onClick={resetAll} type="button">
                    ส่งหลักฐานเพิ่ม
                  </Button>
                </div>
              </div>
            </Card>
          ) : (
            <Button type="submit" size="lg" disabled={phase === "uploading"} className="w-full">
              {phase === "uploading" ? <Loader2 className="animate-spin" /> : <Send />}
              {phase === "uploading" ? "กำลังอัปโหลด… กรุณาอย่าปิดหน้านี้" : "ส่งหลักฐาน"}
            </Button>
          )}
        </div>
      </form>
    </>
  );
}

function PickerButton({
  icon,
  label,
  accept,
  capture,
  multiple,
  onFiles,
}: {
  icon: React.ReactNode;
  label: string;
  accept: string;
  capture?: "environment" | "user";
  multiple?: boolean;
  onFiles: (f: FileList | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Button type="button" variant="secondary" className="h-11" onClick={() => ref.current?.click()}>
        {icon}
        {label}
      </Button>
      <input
        ref={ref}
        type="file"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        accept={accept}
        multiple={multiple}
        {...(capture ? { capture } : {})}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </>
  );
}

const STATUS_TEXT: Record<ItemStatus, string> = {
  ready: "พร้อมส่ง",
  invalid: "ไม่ผ่านการตรวจสอบ",
  queued: "รอคิว",
  uploading: "กำลังอัปโหลด",
  done: "อัปโหลดสำเร็จ",
  failed: "อัปโหลดไม่สำเร็จ",
};

function FileCard({
  item,
  canRemove,
  canRetry,
  onRemove,
  onRetry,
}: {
  item: Item;
  canRemove: boolean;
  canRetry: boolean;
  onRemove: () => void;
  onRetry: () => void;
}) {
  const tone =
    item.status === "done"
      ? "text-emerald-600 dark:text-emerald-400"
      : item.status === "failed" || item.status === "invalid"
        ? "text-rose-600 dark:text-rose-400"
        : "text-muted";
  return (
    <div className="flex gap-3 rounded-2xl border border-white/80 bg-white/70 p-3 dark:border-slate-700/60 dark:bg-slate-900/50" data-testid="file-card">
      <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-slate-100 dark:bg-slate-800">
        {item.mediaType === "IMAGE" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.previewUrl} alt={item.file.name} className="size-full object-cover" />
        )}
        {item.mediaType === "VIDEO" && <video src={item.previewUrl} className="size-full object-cover" muted playsInline preload="metadata" />}
        {!item.mediaType && <XCircle className="absolute inset-0 m-auto size-8 text-rose-400" />}
        {item.mediaType === "VIDEO" && <Film className="absolute bottom-1 right-1 size-4 text-white drop-shadow" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium" title={item.file.name}>
          {item.file.name}
        </p>
        <p className="text-xs text-muted">
          {formatBytes(item.file.size)} · {item.file.type || "ไม่ทราบชนิด"} · {item.mediaType === "IMAGE" ? "รูปภาพ" : item.mediaType === "VIDEO" ? "วิดีโอ" : "-"}
        </p>
        {(item.status === "uploading" || item.status === "queued" || item.status === "done") && (
          <div className="mt-2 flex items-center gap-2">
            <Progress value={item.progress} className="h-2" />
            <span className="w-10 text-right text-xs tabular-nums">{item.progress}%</span>
          </div>
        )}
        <p className={cn("mt-1 text-xs", tone)} data-testid="file-status">
          {item.status === "uploading" && <Loader2 className="mr-1 inline size-3 animate-spin" />}
          {STATUS_TEXT[item.status]}
          {item.error ? ` — ${item.error}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1">
        {canRetry && (
          <Button type="button" size="sm" variant="soft" onClick={onRetry}>
            <RotateCcw /> ลองใหม่
          </Button>
        )}
        {canRemove && (
          <Button type="button" size="icon" variant="ghost" onClick={onRemove} aria-label={`นำ ${item.file.name} ออก`}>
            <Trash2 />
          </Button>
        )}
      </div>
    </div>
  );
}
