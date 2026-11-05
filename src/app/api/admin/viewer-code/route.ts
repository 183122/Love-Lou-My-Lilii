import { z } from "zod";
import { requireRole } from "@/lib/server/auth";
import { getRepo } from "@/lib/server/backends";
import { hashPassword } from "@/lib/server/crypto";
import { json, readJson, route } from "@/lib/server/http";
import { SECRET_KEYS } from "@/lib/server/settings";

const schema = z.object({
  code: z.string().min(8, "รหัสเข้าถึงต้องมีอย่างน้อย 8 ตัวอักษร").max(100).nullable(),
});

/** Set (or disable with null) the read-only viewer access code. Existing viewer sessions are revoked. */
export const PUT = route(async (req: Request) => {
  await requireRole(req, "ADMIN");
  const { code } = schema.parse(await readJson(req));
  const repo = getRepo();
  if (code) await repo.setSetting(SECRET_KEYS.viewerCodeHash, await hashPassword(code), true);
  else await repo.deleteSetting(SECRET_KEYS.viewerCodeHash);
  await repo.deleteSessionsByRole("VIEWER");
  return json({ enabled: Boolean(code) });
});
