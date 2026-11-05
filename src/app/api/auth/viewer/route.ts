import { z } from "zod";
import { createSession } from "@/lib/server/auth";
import { verifyPassword } from "@/lib/server/crypto";
import { env } from "@/lib/server/env";
import { assertSameOrigin, HttpError, ipHash, json, readJson, route } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { getSecretSetting, SECRET_KEYS } from "@/lib/server/settings";

const schema = z.object({ code: z.string().min(1, "กรุณากรอกรหัสเข้าถึง").max(200) });

/** Read-only access code → VIEWER session (view/download evidence only). */
export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await enforceRateLimit(req, "viewer");
  const { code } = schema.parse(await readJson(req));
  const hash = (await getSecretSetting<string>(SECRET_KEYS.viewerCodeHash)) || env.viewerAccessCodeHash;
  if (!hash) throw new HttpError(403, "ผู้ดูแลยังไม่ได้เปิดรหัสเข้าถึงสำหรับผู้ชม", "VIEWER_DISABLED");
  if (!(await verifyPassword(code, hash))) throw new HttpError(401, "รหัสเข้าถึงไม่ถูกต้อง", "BAD_CODE");
  const s = await createSession("VIEWER", { ipHash: ipHash(req), userAgent: req.headers.get("user-agent") ?? "" });
  return json(s);
});
