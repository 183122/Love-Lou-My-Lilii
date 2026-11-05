import { requireRole } from "@/lib/server/auth";
import { getReadableFile, streamFile } from "@/lib/server/evidence";
import { route } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

export const maxDuration = 300;

/** Authenticated proxy to Google Drive. Files are never made public. */
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireRole(req, "VIEWER");
  await enforceRateLimit(req, "fileRead");
  const { id } = await ctx.params;
  const file = await getReadableFile(id);
  const download = new URL(req.url).searchParams.get("download") === "1";
  return streamFile(file, req.headers.get("range"), download);
});
