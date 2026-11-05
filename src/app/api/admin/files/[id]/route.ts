import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import { getRepo } from "@/lib/server/backends";
import { deleteEvidence } from "@/lib/server/evidence";
import { HttpError, json, readJson, route } from "@/lib/server/http";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  is_vtr_selected: z.boolean().optional(),
  vtr_note: z.string().trim().max(2000).optional(),
});

export const PATCH = route(async (req: Request, ctx: Ctx) => {
  await requireRole(req, "ADMIN");
  const { id } = await ctx.params;
  const patch = patchSchema.parse(await readJson(req));
  const repo = getRepo();
  const file = await repo.getFile(id);
  if (!file) throw new HttpError(404, "ไม่พบไฟล์", "NOT_FOUND");
  if (patch.is_vtr_selected && file.status !== "UPLOADED")
    throw new HttpError(400, "เลือกได้เฉพาะไฟล์ที่อัปโหลดสำเร็จ", "NOT_UPLOADED");
  const update: Parameters<typeof repo.updateFile>[1] = { ...patch };
  if (patch.is_vtr_selected === true && !file.is_vtr_selected) {
    const selected = await repo.listFiles({ vtrOnly: true });
    update.vtr_order = selected.reduce((m, f) => Math.max(m, f.vtr_order ?? 0), 0) + 1;
  }
  if (patch.is_vtr_selected === false) update.vtr_order = null;
  return json(await repo.updateFile(id, update));
});

const delSchema = z.object({ mode: z.enum(["database", "drive"]), confirm: z.literal(true) });

export const DELETE = route(async (req: Request, ctx: Ctx) => {
  await requireRole(req, "ADMIN");
  const { id } = await ctx.params;
  const { mode } = delSchema.parse(await readJson(req));
  return json(await deleteEvidence(id, mode));
});
