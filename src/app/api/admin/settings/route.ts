import { requireRole } from "@/lib/server/auth";
import { getRepo } from "@/lib/server/backends";
import { json, readJson, route } from "@/lib/server/http";
import { getSecretSetting, loadSettings, SECRET_KEYS, SETTING_KEYS, type AppSettings } from "@/lib/server/settings";
import { settingsInputSchema } from "@/lib/server/validation";
import { env } from "@/lib/server/env";

export const GET = route(async (req: Request) => {
  await requireRole(req, "ADMIN");
  const settings = await loadSettings();
  const viewerCode = Boolean((await getSecretSetting(SECRET_KEYS.viewerCodeHash)) || env.viewerAccessCodeHash);
  return json({
    settings,
    security: {
      viewerCodeEnabled: viewerCode,
      turnstileConfigured: Boolean(env.turnstileSiteKey && env.turnstileSecretKey),
      rootFolderFromEnv: Boolean(env.googleDriveRootFolderId),
      driveScope: env.googleDriveScope,
    },
  });
});

export const PUT = route(async (req: Request) => {
  await requireRole(req, "ADMIN");
  const patch = settingsInputSchema.parse(await readJson(req));
  const repo = getRepo();
  for (const [field, value] of Object.entries(patch) as [keyof AppSettings, unknown][]) {
    if (value === undefined) continue;
    await repo.setSetting(SETTING_KEYS[field], value);
  }
  return json({ settings: await loadSettings() });
});
