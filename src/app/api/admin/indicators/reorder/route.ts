import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import { getRepo } from "@/lib/server/backends";
import { json, readJson, route } from "@/lib/server/http";

const schema = z.object({ ids: z.array(z.uuid()).min(1).max(500) });

/** Persist a new order: sort_order = position in the list (within its category). */
export const POST = route(async (req: Request) => {
  await requireRole(req, "ADMIN");
  const { ids } = schema.parse(await readJson(req));
  const repo = getRepo();
  for (const [i, id] of ids.entries()) await repo.updateIndicator(id, { sort_order: i + 1 });
  return json({ ok: true });
});
