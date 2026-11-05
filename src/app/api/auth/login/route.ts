import { z } from "zod";
import { createSession } from "@/lib/server/auth";
import { isTestMode } from "@/lib/server/backends";
import { verifyPassword } from "@/lib/server/crypto";
import { env } from "@/lib/server/env";
import { assertSameOrigin, HttpError, ipHash, json, readJson, route } from "@/lib/server/http";
import { enforceRateLimit } from "@/lib/server/rate-limit";

const schema = z.object({ password: z.string().min(1, "กรุณากรอกรหัสผ่าน").max(200) });

export const POST = route(async (req: Request) => {
  assertSameOrigin(req);
  await enforceRateLimit(req, "login");
  const { password } = schema.parse(await readJson(req));
  const hash = env.adminPasswordHash || (isTestMode() ? process.env.VTR_TEST_ADMIN_HASH ?? "" : "");
  if (!hash) throw new HttpError(503, "ยังไม่ได้ตั้งค่า ADMIN_PASSWORD_HASH บนเซิร์ฟเวอร์", "NOT_CONFIGURED");
  if (!(await verifyPassword(password, hash))) throw new HttpError(401, "รหัสผ่านไม่ถูกต้อง", "BAD_PASSWORD");
  const s = await createSession("ADMIN", { ipHash: ipHash(req), userAgent: req.headers.get("user-agent") ?? "" });
  return json(s);
});
