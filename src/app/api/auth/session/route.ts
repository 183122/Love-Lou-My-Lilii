import { getSession } from "@/lib/server/auth";
import { json, route } from "@/lib/server/http";

export const GET = route(async () => {
  const s = await getSession();
  return json(s ? { role: s.role, csrfToken: s.csrfToken, expiresAt: s.expiresAt } : { role: null });
});
