import { getSession } from "@/lib/server/auth";
import { buildDashboard } from "@/lib/server/dashboard";
import { HttpError, json, route } from "@/lib/server/http";
import { loadSettings } from "@/lib/server/settings";

/** Aggregated progress only — no submitter names or file contents (non-sensitive). */
export const GET = route(async () => {
  const settings = await loadSettings();
  if (!settings.publicDashboard) {
    const s = await getSession();
    if (!s) throw new HttpError(401, "แดชบอร์ดเปิดให้เฉพาะผู้มีรหัสเข้าถึง", "UNAUTHENTICATED");
  }
  return json(await buildDashboard());
});
