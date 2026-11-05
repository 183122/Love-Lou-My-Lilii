import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import { getRepo } from "@/lib/server/backends";
import { json, readJson, route } from "@/lib/server/http";

const schema = z.object({ ids: z.array(z.uuid()).max(1000) });

export const POST = route(async (req: Request) => {
  await requireRole(req, "ADMIN");
  const { ids } = schema.parse(await readJson(req, 128 * 1024));
  const repo = getRepo();
  for (const [i, id] of ids.entries()) await repo.updateFile(id, { vtr_order: i + 1 });
  return json({ ok: true });
});
