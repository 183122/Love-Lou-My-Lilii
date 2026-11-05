import { requireRole } from "@/lib/server/auth";
import { syncFolderTree } from "@/lib/server/drive/service";
import { json, route } from "@/lib/server/http";

export const maxDuration = 300;

/** Create or repair ROOT / category / indicator folders (idempotent, never duplicates). */
export const POST = route(async (req: Request) => {
  await requireRole(req, "ADMIN");
  return json(await syncFolderTree());
});
