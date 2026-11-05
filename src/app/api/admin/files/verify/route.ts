import { requireRole } from "@/lib/server/auth";
import { verifyAllFiles } from "@/lib/server/evidence";
import { json, route } from "@/lib/server/http";

export const maxDuration = 300;

/** Check every file still exists in Google Drive; missing files are excluded from progress. */
export const POST = route(async (req: Request) => {
  await requireRole(req, "ADMIN");
  return json(await verifyAllFiles());
});
