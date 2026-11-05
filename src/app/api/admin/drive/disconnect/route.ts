import { requireRole } from "@/lib/server/auth";
import { decryptSecret } from "@/lib/server/crypto";
import { revokeToken } from "@/lib/server/drive/google-drive";
import { clearStoredToken, type StoredOAuth } from "@/lib/server/drive/service";
import { env } from "@/lib/server/env";
import { json, route } from "@/lib/server/http";
import { getSecretSetting, SECRET_KEYS } from "@/lib/server/settings";

/** Remove the stored token (and revoke it at Google). Uploaded files are not affected. */
export const POST = route(async (req: Request) => {
  await requireRole(req, "ADMIN");
  const stored = await getSecretSetting<StoredOAuth>(SECRET_KEYS.googleOAuth);
  if (stored?.refresh_token_enc) {
    try {
      await revokeToken(decryptSecret(stored.refresh_token_enc, env.tokenEncryptionKey || env.sessionSecret));
    } catch {
      /* already invalid */
    }
  }
  await clearStoredToken();
  return json({ ok: true, envTokenStillSet: Boolean(env.googleRefreshToken) });
});
