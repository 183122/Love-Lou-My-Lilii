import { requireRole } from "@/lib/server/auth";
import { listEvidence } from "@/lib/server/evidence";
import { json, route } from "@/lib/server/http";

/** All evidence including pending/failed/missing (admin management). */
export const GET = route(async (req: Request) => {
  await requireRole(req, "ADMIN");
  return json({ items: await listEvidence({ includeAllStatuses: true }) });
});
