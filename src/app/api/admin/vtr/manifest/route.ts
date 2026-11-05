import { requireRole } from "@/lib/server/auth";
import { listEvidence } from "@/lib/server/evidence";
import { route } from "@/lib/server/http";
import { buildManifestCsv, sortVtr } from "@/lib/shared/manifest";

/** Editor manifest of VTR-selected files (CSV with UTF-8 BOM for Excel, or JSON). */
export const GET = route(async (req: Request) => {
  await requireRole(req, "ADMIN");
  const items = sortVtr(await listEvidence({ vtrOnly: true }));
  const format = new URL(req.url).searchParams.get("format");
  const rows = items.map((it, i) => ({
    order: i + 1,
    category: `${it.category.code}. ${it.category.name}`,
    indicator: `${it.indicator.code} ${it.indicator.title}`,
    activity: it.submission.activity_title,
    file_name: it.file_name,
    file_type: it.media_type === "IMAGE" ? "รูปภาพ" : "วิดีโอ",
    note: it.vtr_note,
  }));
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    return new Response(JSON.stringify({ generated_at: new Date().toISOString(), items: rows }, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="vtr-manifest-${stamp}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(buildManifestCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vtr-manifest-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
