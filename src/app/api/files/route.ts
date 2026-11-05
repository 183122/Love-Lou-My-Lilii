import { requireRole } from "@/lib/server/auth";
import { listEvidence } from "@/lib/server/evidence";
import { json, route } from "@/lib/server/http";

/** Evidence list for authorised viewers/admins. Admins may pass ?all=1 to include failed/pending files. */
export const GET = route(async (req: Request) => {
  const session = await requireRole(req, "VIEWER");
  const sp = new URL(req.url).searchParams;
  const media = sp.get("type");
  const items = await listEvidence({
    indicatorId: sp.get("indicator") || undefined,
    mediaType: media === "IMAGE" || media === "VIDEO" ? media : undefined,
    vtrOnly: sp.get("vtr") === "1",
    includeAllStatuses: sp.get("all") === "1" && session.role === "ADMIN",
  });
  return json({ items, role: session.role });
});
