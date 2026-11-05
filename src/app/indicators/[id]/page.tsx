"use client";
import { ArrowLeft, Film, ImageIcon, Upload } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { AccessGate } from "@/components/auth/access-gate";
import { LoadError } from "@/components/dashboard/setup-notice";
import { EvidenceGallery } from "@/components/gallery/evidence-gallery";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader, Progress, Skeleton, StatusBadge } from "@/components/ui/misc";
import { useFetch } from "@/lib/client/use-fetch";
import type { Category, DashboardData, Indicator } from "@/lib/shared/types";

export default function IndicatorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const meta = useFetch<{ categories: Category[]; indicators: Indicator[] }>("/api/indicators");
  const dash = useFetch<DashboardData>("/api/dashboard", { refreshMs: 30_000 });

  if (meta.error && !meta.data) return <LoadError error={meta.error} onRetry={meta.refresh} />;
  if (!meta.data) return <Skeleton className="h-64" />;
  const ind = meta.data.indicators.find((i) => i.id === id);
  if (!ind) return <Card><EmptyState title="ไม่พบตัวชี้วัด" /></Card>;
  const cat = meta.data.categories.find((c) => c.id === ind.category_id);
  const prog = dash.data?.indicators.find((i) => i.id === id);
  const need = ind.required_image_count + ind.required_video_count;
  const have = prog ? Math.min(prog.image_count, ind.required_image_count) + Math.min(prog.video_count, ind.required_video_count) : 0;

  return (
    <>
      <Link href="/indicators" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-violet-600">
        <ArrowLeft className="size-4" /> ตัวชี้วัดทั้งหมด
      </Link>
      <PageHeader
        title={`${ind.code} ${ind.title}`}
        description={cat ? `${cat.code}. ${cat.name}` : undefined}
        actions={
          <Button asChild>
            <Link href={`/submit?indicator=${ind.id}`}>
              <Upload /> ส่งหลักฐานตัวชี้วัดนี้
            </Link>
          </Button>
        }
      />
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card className="p-5 md:col-span-2">
          <p className="text-sm font-medium">หลักฐานที่แนะนำ</p>
          <p className="mt-1 text-sm text-muted">{ind.recommended_evidence || "-"}</p>
          {ind.description && <p className="mt-3 text-sm text-muted">{ind.description}</p>}
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">ความครบถ้วน</p>
            {prog && <StatusBadge status={prog.status} />}
          </div>
          <div className="mt-3 grid gap-2 text-sm">
            <p className="flex items-center gap-2">
              <ImageIcon className="size-4 text-sky-500" /> รูปภาพ {prog?.image_count ?? 0} / {ind.required_image_count}
            </p>
            <p className="flex items-center gap-2">
              <Film className="size-4 text-pink-500" /> วิดีโอ {prog?.video_count ?? 0} / {ind.required_video_count}
            </p>
          </div>
          <Progress className="mt-3" value={need ? (have / need) * 100 : prog && prog.status !== "NOT_SUBMITTED" ? 100 : 0} />
        </Card>
      </div>
      <h2 className="mb-3 text-lg font-semibold">หลักฐานที่ส่งแล้ว</h2>
      <AccessGate need="VIEWER">
        <EvidenceGallery indicatorId={ind.id} hideIndicatorFilter />
      </AccessGate>
    </>
  );
}
