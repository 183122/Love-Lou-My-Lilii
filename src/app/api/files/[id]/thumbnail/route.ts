import { requireRole } from "@/lib/server/auth";
import { getDrive } from "@/lib/server/drive/service";
import { DriveError } from "@/lib/server/drive/types";
import { getReadableFile, markMissing } from "@/lib/server/evidence";
import { HttpError, route } from "@/lib/server/http";

/** Drive-generated thumbnail (images and most videos). 204 when Drive has none yet. */
export const GET = route(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireRole(req, "VIEWER");
  const { id } = await ctx.params;
  const file = await getReadableFile(id);
  const drive = await getDrive();
  let res: Response | null;
  try {
    res = await drive.thumbnail(file.drive_file_id!);
  } catch (e) {
    if (e instanceof DriveError && e.code === "NOT_FOUND") {
      await markMissing(file);
      throw new HttpError(410, "ไฟล์ถูกลบจาก Google Drive", "MISSING");
    }
    throw e;
  }
  if (!res?.body) return new Response(null, { status: 204, headers: { "Cache-Control": "private, max-age=60" } });
  return new Response(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
