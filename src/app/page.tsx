"use client";
import { motion } from "framer-motion";
import { CheckCircle2, CircleDashed, Clapperboard, Film, ImageIcon, ListChecks, RefreshCw, TrendingUp, Upload } from "lucide-react";
import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { IndicatorRow } from "@/components/dashboard/indicator-row";
import { LoadError } from "@/components/dashboard/setup-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, PageHeader, Progress, Skeleton, StatusBadge } from "@/components/ui/misc";
import { useFetch } from "@/lib/client/use-fetch";
import type { DashboardData } from "@/lib/shared/types";
import { thDateTime } from "@/lib/utils";

const COLORS = { COMPLETED: "#34d399", PARTIAL: "#fbbf24", NOT_SUBMITTED: "#fb7185" };

function Stat({ label, value, icon, tone, sub, compact }: { label: string; value: string | number; icon: React.ReactNode; tone: string; sub?: string; compact?: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs text-muted sm:text-sm">{label}</p>
            <p className="mt-1 text-2xl font-semibold sm:text-3xl" data-testid={`stat-${label}`}>
              {value}
            </p>
            {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
          </div>
          <span className={`${compact ? "hidden sm:grid" : "grid"} size-10 shrink-0 place-items-center rounded-xl ${tone}`}>{icon}</span>
        </div>
      </Card>
    </motion.div>
  );
}

export default function DashboardPage() {
  const { data, error, loading, refreshing, refresh } = useFetch<DashboardData>("/api/dashboard", { refreshMs: 30_000 });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={data ? `อัปเดตล่าสุด ${thDateTime(data.generated_at)} · รีเฟรชอัตโนมัติทุก 30 วินาที` : "ภาพรวมความคืบหน้าการส่งหลักฐาน"}
        actions={
          <>
            <Button variant="secondary" onClick={refresh} disabled={refreshing} aria-label="รีเฟรช Dashboard">
              <RefreshCw className={refreshing ? "animate-spin" : ""} /> รีเฟรช
            </Button>
            <Button asChild>
              <Link href="/submit">
                <Upload /> ส่งหลักฐาน
              </Link>
            </Button>
          </>
        }
      />

      {error && !data && <LoadError error={error} onRetry={refresh} />}

      {loading && !data && (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      )}

      {data && (
        <div className="grid min-w-0 gap-4 sm:gap-6 [&>*]:min-w-0">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 [&>*]:min-w-0">
            <Stat label="ตัวชี้วัดทั้งหมด" value={data.totals.indicators} icon={<ListChecks className="size-5" />} tone="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300" />
            <Stat
              label="ส่งหลักฐานแล้ว"
              value={data.totals.submitted}
              sub={`ครบ ${data.totals.completed} · บางส่วน ${data.totals.partial}`}
              icon={<CheckCircle2 className="size-5" />}
              tone="bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
            />
            <Stat label="ยังไม่ส่ง" value={data.totals.not_submitted} icon={<CircleDashed className="size-5" />} tone="bg-rose-100 text-rose-500 dark:bg-rose-500/15 dark:text-rose-300" />
            <Stat
              label="ความคืบหน้า"
              value={`${data.totals.percent}%`}
              sub="คิดจากตัวชี้วัดที่ส่งครบเกณฑ์"
              icon={<TrendingUp className="size-5" />}
              tone="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300"
            />
          </div>

          <div className="grid grid-cols-3 gap-3 sm:gap-4 [&>*]:min-w-0">
            <Stat compact label="รูปภาพทั้งหมด" value={data.totals.images} icon={<ImageIcon className="size-5" />} tone="bg-sky-50 text-sky-500 dark:bg-sky-500/10" />
            <Stat compact label="วิดีโอทั้งหมด" value={data.totals.videos} icon={<Film className="size-5" />} tone="bg-pink-50 text-pink-500 dark:bg-pink-500/10" />
            <Stat compact label="คัดเลือกสำหรับ VTR" value={data.totals.vtr_selected} icon={<Clapperboard className="size-5" />} tone="bg-violet-50 text-violet-500 dark:bg-violet-500/10" />
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-5 [&>*]:min-w-0">
            <Card className="min-w-0 lg:col-span-2">
              <CardHeader>
                <CardTitle>สถานะตัวชี้วัด</CardTitle>
                <CardDescription>คำนวณจากไฟล์ที่อัปโหลดสำเร็จเทียบกับเกณฑ์ขั้นต่ำ</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: "ส่งครบแล้ว", value: data.totals.completed, key: "COMPLETED" },
                          { name: "ส่งบางส่วน", value: data.totals.partial, key: "PARTIAL" },
                          { name: "ยังไม่ส่ง", value: data.totals.not_submitted, key: "NOT_SUBMITTED" },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="62%"
                        outerRadius="90%"
                        paddingAngle={2}
                        stroke="none"
                      >
                        {(["COMPLETED", "PARTIAL", "NOT_SUBMITTED"] as const).map((k) => (
                          <Cell key={k} fill={COLORS[k]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [`${v} ตัวชี้วัด`, ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div>
                      <p className="text-3xl font-semibold">{data.totals.percent}%</p>
                      <p className="text-xs text-muted">ส่งครบ</p>
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap justify-center gap-4 text-xs">
                  {[
                    ["ส่งครบแล้ว", COLORS.COMPLETED, data.totals.completed],
                    ["ส่งบางส่วน", COLORS.PARTIAL, data.totals.partial],
                    ["ยังไม่ส่ง", COLORS.NOT_SUBMITTED, data.totals.not_submitted],
                  ].map(([l, c, n]) => (
                    <span key={l as string} className="inline-flex items-center gap-1.5">
                      <span className="size-2.5 rounded-full" style={{ background: c as string }} /> {l} ({n})
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="min-w-0 lg:col-span-3">
              <CardHeader>
                <CardTitle>ความคืบหน้าแยกตามหมวด</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {data.categories.map((c) => (
                  <div key={c.id}>
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                      <span className="truncate">
                        <span className="font-semibold">{c.code}.</span> {c.name}
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {c.completed}/{c.total} · {c.percent}%
                      </span>
                    </div>
                    <Progress value={c.percent} color={`linear-gradient(90deg, ${c.color}, #c4b5fd)`} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <CardHeader>
                <CardTitle>ส่งหลักฐานล่าสุด</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1">
                {data.recent.length === 0 ? (
                  <EmptyState title="ยังไม่มีการส่งหลักฐาน" description="เมื่อมีการอัปโหลดสำเร็จ รายการจะแสดงที่นี่" />
                ) : (
                  data.recent.map((r) => {
                    const row = data.indicators.find((i) => i.code === r.code)!;
                    return (
                      <div key={r.code}>
                        <IndicatorRow row={row} />
                        <p className="-mt-1 pl-[4.5rem] text-[11px] text-muted">{thDateTime(r.last_uploaded_at)}</p>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>ตัวชี้วัดที่ยังไม่ส่ง</CardTitle>
                <Link href="/pending" className="text-sm text-violet-600 hover:underline dark:text-violet-300">
                  ดูทั้งหมด
                </Link>
              </CardHeader>
              <CardContent className="grid max-h-[28rem] gap-1 overflow-y-auto">
                {data.indicators.filter((i) => i.status === "NOT_SUBMITTED").length === 0 ? (
                  <EmptyState title="ส่งหลักฐานครบทุกตัวชี้วัดแล้ว" icon={<CheckCircle2 className="size-7" />} />
                ) : (
                  data.indicators
                    .filter((i) => i.status === "NOT_SUBMITTED")
                    .map((r) => <IndicatorRow key={r.id} row={r} />)
                )}
              </CardContent>
            </Card>
          </div>
          <p className="text-center text-xs text-muted">
            สถานะ: <StatusBadge status="COMPLETED" /> ครบตามเกณฑ์ขั้นต่ำ · <StatusBadge status="PARTIAL" /> มีไฟล์แต่ยังไม่ครบ ·{" "}
            <StatusBadge status="NOT_SUBMITTED" /> ไม่มีไฟล์ที่อัปโหลดสำเร็จ
          </p>
        </div>
      )}
    </>
  );
}
