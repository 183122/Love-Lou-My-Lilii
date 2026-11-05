import { requireRole } from "@/lib/server/auth";
import { getRepo } from "@/lib/server/backends";
import { HttpError, json, readJson, route } from "@/lib/server/http";
import { indicatorInputSchema } from "@/lib/server/validation";

export const POST = route(async (req: Request) => {
  await requireRole(req, "ADMIN");
  const input = indicatorInputSchema.parse(await readJson(req));
  const repo = getRepo();
  if (!(await repo.listCategories()).some((c) => c.id === input.category_id))
    throw new HttpError(400, "ไม่พบหมวดที่เลือก", "BAD_CATEGORY");
  return json(await repo.createIndicator(input), { status: 201 });
});
