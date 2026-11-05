import "server-only";
import { computeIndicatorStatus } from "@/lib/shared/status";
import type { DashboardData, IndicatorProgress } from "@/lib/shared/types";
import { getRepo } from "./backends";

/** Builds dashboard data from the database (only active indicators; only UPLOADED files count). */
export async function buildDashboard(): Promise<DashboardData> {
  const repo = getRepo();
  const [categories, indicators, counts] = await Promise.all([
    repo.listCategories(),
    repo.listIndicators(),
    repo.getIndicatorCounts(),
  ]);
  const activeCats = categories.filter((c) => c.is_active);
  const catById = new Map(activeCats.map((c) => [c.id, c]));
  const countBy = new Map(counts.map((c) => [c.indicator_id, c]));

  const rows: IndicatorProgress[] = indicators
    .filter((i) => i.is_active && catById.has(i.category_id))
    .sort((a, b) => {
      const ca = catById.get(a.category_id)!;
      const cb = catById.get(b.category_id)!;
      return ca.sort_order - cb.sort_order || a.sort_order - b.sort_order || a.code.localeCompare(b.code);
    })
    .map((i) => {
      const c = countBy.get(i.id);
      const cat = catById.get(i.category_id)!;
      const image_count = c?.image_count ?? 0;
      const video_count = c?.video_count ?? 0;
      return {
        id: i.id,
        code: i.code,
        title: i.title,
        category_id: cat.id,
        category_code: cat.code,
        category_name: cat.name,
        required_image_count: i.required_image_count,
        required_video_count: i.required_video_count,
        image_count,
        video_count,
        vtr_selected_count: c?.vtr_selected_count ?? 0,
        last_uploaded_at: c?.last_uploaded_at ?? null,
        status: computeIndicatorStatus({
          imageCount: image_count,
          videoCount: video_count,
          requiredImages: i.required_image_count,
          requiredVideos: i.required_video_count,
        }),
      };
    });

  const completed = rows.filter((r) => r.status === "COMPLETED").length;
  const partial = rows.filter((r) => r.status === "PARTIAL").length;
  const total = rows.length;
  const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

  return {
    generated_at: new Date().toISOString(),
    totals: {
      indicators: total,
      submitted: completed + partial,
      completed,
      partial,
      not_submitted: total - completed - partial,
      percent: pct(completed, total),
      images: rows.reduce((s, r) => s + r.image_count, 0),
      videos: rows.reduce((s, r) => s + r.video_count, 0),
      vtr_selected: rows.reduce((s, r) => s + r.vtr_selected_count, 0),
    },
    categories: activeCats.map((c) => {
      const mine = rows.filter((r) => r.category_id === c.id);
      const done = mine.filter((r) => r.status === "COMPLETED").length;
      return {
        id: c.id,
        code: c.code,
        name: c.name,
        color: c.color,
        total: mine.length,
        completed: done,
        partial: mine.filter((r) => r.status === "PARTIAL").length,
        percent: pct(done, mine.length),
      };
    }),
    indicators: rows,
    recent: rows
      .filter((r) => r.last_uploaded_at)
      .sort((a, b) => b.last_uploaded_at!.localeCompare(a.last_uploaded_at!))
      .slice(0, 8)
      .map((r) => ({ code: r.code, title: r.title, last_uploaded_at: r.last_uploaded_at!, status: r.status })),
  };
}
