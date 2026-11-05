import { requireRole } from "@/lib/server/auth";
import { getRepo } from "@/lib/server/backends";
import { HttpError, json, readJson, route } from "@/lib/server/http";
import { indicatorInputSchema } from "@/lib/server/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  await requireRole(req, "ADMIN");
  const { id } = await ctx.params;
  const patch = indicatorInputSchema.partial().parse(await readJson(req));
  const row = await getRepo().updateIndicator(id, patch);
  if (!row) throw new HttpError(404, "ไม่พบตัวชี้วัด", "NOT_FOUND");
  return json(row);
});

export const DELETE = route(async (req: Request, ctx: Ctx) => {
  await requireRole(req, "ADMIN");
  const { id } = await ctx.params;
  const repo = getRepo();
  if ((await repo.countFilesForIndicator(id)) > 0)
    throw new HttpError(409, "ตัวชี้วัดนี้มีหลักฐานแล้ว ไม่สามารถลบได้ — ให้ปิดใช้งานแทน", "HAS_FILES");
  await repo.deleteIndicator(id);
  return json({ ok: true });
});
