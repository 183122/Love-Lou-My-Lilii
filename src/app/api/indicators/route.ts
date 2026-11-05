import { getRepo } from "@/lib/server/backends";
import { getSession } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";

/** Categories + indicators. Inactive ones are included only for admins (?all=1). */
export const GET = route(async (req: Request) => {
  const repo = getRepo();
  const all = new URL(req.url).searchParams.get("all") === "1" && (await getSession())?.role === "ADMIN";
  const [categories, indicators] = await Promise.all([repo.listCategories(), repo.listIndicators()]);
  const cats = all ? categories : categories.filter((c) => c.is_active);
  const ids = new Set(cats.map((c) => c.id));
  return json({
    categories: cats,
    indicators: indicators.filter((i) => ids.has(i.category_id) && (all || i.is_active)),
  });
});
