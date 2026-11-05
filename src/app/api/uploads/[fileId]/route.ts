import { HttpError, json, route, assertSameOrigin } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getUploadStatus, handleChunk } from "@/lib/server/uploads";
import { CHUNK_SIZE } from "@/lib/shared/files";

export const maxDuration = 60;

type Ctx = { params: Promise<{ fileId: string }> };

/** Upload one chunk. Body = raw bytes; headers: Content-Range, X-Upload-Token. */
export const PUT = route(async (req: Request, ctx: Ctx) => {
  assertSameOrigin(req);
  const { fileId } = await ctx.params;
  await enforceRateLimit(req, "chunk");
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > CHUNK_SIZE) throw new HttpError(413, "ชิ้นข้อมูลใหญ่เกินกำหนด", "CHUNK_TOO_LARGE");
  const body = new Uint8Array(await req.arrayBuffer());
  if (body.byteLength > CHUNK_SIZE) throw new HttpError(413, "ชิ้นข้อมูลใหญ่เกินกำหนด", "CHUNK_TOO_LARGE");
  const result = await handleChunk(fileId, req.headers.get("x-upload-token"), req.headers.get("content-range"), body);
  return json(result);
});

/** Resume support: how many bytes has Drive committed? */
export const GET = route(async (req: Request, ctx: Ctx) => {
  const { fileId } = await ctx.params;
  await enforceRateLimit(req, "chunk");
  return json(await getUploadStatus(fileId, req.headers.get("x-upload-token")));
});
