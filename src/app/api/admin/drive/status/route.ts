import { requireRole } from "@/lib/server/auth";
import { getDriveStatus } from "@/lib/server/drive/service";
import { json, route } from "@/lib/server/http";

/** Real connection check (calls Google APIs). */
export const GET = route(async (req: Request) => {
  await requireRole(req, "ADMIN");
  return json(await getDriveStatus());
});
