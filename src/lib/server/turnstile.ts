import "server-only";
import { isTestMode } from "./backends";
import { env } from "./env";
import { clientIp, HttpError } from "./http";

/**
 * Verify a Cloudflare Turnstile token. When Turnstile keys are not configured
 * the check is skipped only if the admin disabled "require CAPTCHA"; otherwise
 * submissions are refused so the system never runs unprotected silently.
 */
export async function verifyTurnstile(req: Request, token: string | undefined, required: boolean) {
  if (isTestMode()) return;
  if (!env.turnstileSecretKey || !env.turnstileSiteKey) {
    if (required)
      throw new HttpError(
        503,
        "ระบบยังไม่ได้ตั้งค่า CAPTCHA (TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY) — แจ้งผู้ดูแลระบบ",
        "CAPTCHA_NOT_CONFIGURED",
      );
    return;
  }
  if (!token) throw new HttpError(400, "กรุณายืนยันว่าไม่ใช่บอท (CAPTCHA)", "CAPTCHA_REQUIRED");
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    body: new URLSearchParams({ secret: env.turnstileSecretKey, response: token, remoteip: clientIp(req) }),
    cache: "no-store",
  }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as { success?: boolean } | null;
  if (!body?.success) throw new HttpError(400, "การยืนยัน CAPTCHA ไม่สำเร็จ กรุณาลองใหม่", "CAPTCHA_FAILED");
}
