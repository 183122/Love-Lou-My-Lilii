"use client";
import { RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, NativeSelect } from "@/components/ui/form";
import { EmptyState, PageHeader, Skeleton } from "@/components/ui/misc";
import { useFetch } from "@/lib/client/use-fetch";
import type { DashboardData, IndicatorStatus } from "@/lib/shared/types";
import { IndicatorRow } from "./indicator-row";
import { LoadError } from "./setup-notice";

/** Indicator list grouped by category, used by /indicators, /submitted and /pending. */
export function IndicatorBoard({
  title,
  description,
  statuses,
  emptyTitle,
}: {
  title: string;
  description: string;
  statuses?: IndicatorStatus[];
  emptyTitle: string;
}) {
  const { data, error, loading, refresh, refreshing } = useFetch<DashboardData>("/api/dashboard", { refreshMs: 60_000 });
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");

  const rows = useMemo(() => {
    if (!data) return [];
    const term = q.trim().toLowerCase();
    return data.indicators.filter(
      (r) =>
        (!statuses || statuses.includes(r.status)) &&
        (!cat || r.category_id === cat) &&
        (!term || r.code.toLowerCase().includes(term) || r.title.toLowerCase().includes(term)),
    );
  }, [data, q, cat, statuses]);

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button variant="secondary" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={refreshing ? "animate-spin" : ""} /> รีเฟรช
          </Button>
        }
      />
      {error && !data && <LoadError error={error} onRetry={refresh} />}
      {loading && !data && <Skeleton className="h-96" />}
      {data && (
        <>
          <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_16rem]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหารหัสหรือชื่อตัวชี้วัด" className="pl-9" aria-label="ค้นหาตัวชี้วัด" />
            </div>
            <NativeSelect value={cat} onChange={(e) => setCat(e.target.value)} aria-label="กรองตามหมวด">
              <option value="">ทุกหมวด</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}. {c.name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <p className="mb-3 text-sm text-muted" data-testid="indicator-count">
            แสดง {rows.length} รายการ
          </p>
          {rows.length === 0 ? (
            <Card>
              <EmptyState title={emptyTitle} />
            </Card>
          ) : (
            <div className="grid gap-4">
              {data.categories
                .filter((c) => rows.some((r) => r.category_id === c.id))
                .map((c) => (
                  <Card key={c.id} className="p-2 sm:p-3">
                    <p className="px-3 pb-1 pt-2 text-sm font-semibold" style={{ color: c.color }}>
                      {c.code}. {c.name}
                    </p>
                    <div className="grid gap-0.5">
                      {rows
                        .filter((r) => r.category_id === c.id)
                        .map((r) => (
                          <IndicatorRow key={r.id} row={r} />
                        ))}
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
