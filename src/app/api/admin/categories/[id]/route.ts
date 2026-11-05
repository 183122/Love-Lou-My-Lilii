import { requireRole } from "@/lib/server/auth";
import { getRepo } from "@/lib/server/backends";
import { HttpError, json, readJson, route } from "@/lib/server/http";
import { categoryInputSchema } from "@/lib/server/validation";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  await requireRole(req, "ADMIN");
  const { id } = await ctx.params;
  const patch = categoryInputSchema.partial().parse(await readJson(req));
  const row = await getRepo().updateCategory(id, patch);
  if (!row) throw new HttpError(404, "ไม่พบหมวด", "NOT_FOUND");
  return json(row);
});

export const DELETE = route(async (req: Request, ctx: Ctx) => {
  await requireRole(req, "ADMIN");
  const { id } = await ctx.params;
  const repo = getRepo();
  if ((await repo.listIndicators()).some((i) => i.category_id === id))
    throw new HttpError(409, "ไม่สามารถลบหมวดที่ยังมีตัวชี้วัด — ให้ปิดใช้งานแทน", "HAS_INDICATORS");
  await repo.deleteCategory(id);
  return json({ ok: true });
});
