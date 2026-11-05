import { getRepo, isTestMode } from "@/lib/server/backends";
import { env } from "@/lib/server/env";
import { json } from "@/lib/server/http";

/**
 * Deployment health check. Reports only the NAMES of missing settings and
 * whether the database answers — never any values.
 */
export async function GET() {
  const required: Record<string, string> = {
    SUPABASE_URL: env.supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: env.supabaseServiceRoleKey,
    SESSION_SECRET: env.sessionSecret.length >= 32 ? env.sessionSecret : "",
    ADMIN_PASSWORD_HASH: env.adminPasswordHash,
    GOOGLE_CLIENT_ID: env.googleClientId,
    GOOGLE_CLIENT_SECRET: env.googleClientSecret,
    TURNSTILE_SITE_KEY: env.turnstileSiteKey,
    TURNSTILE_SECRET_KEY: env.turnstileSecretKey,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  let database: { ok: boolean; indicators?: number; error?: string } = { ok: false, error: "not checked" };
  if (env.supabaseUrl && env.supabaseServiceRoleKey) {
    try {
      const n = (await getRepo().listIndicators()).length;
      database = { ok: n > 0, indicators: n, ...(n === 0 ? { error: "no indicators — run supabase/install.sql" } : {}) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      database = {
        ok: false,
        error: /relation|does not exist|schema cache|PGRST205/i.test(msg)
          ? "tables not found — run supabase/install.sql in the Supabase SQL Editor"
          : /Invalid API key|JWT|apikey|401|403/i.test(msg)
            ? "Supabase rejected the key — SUPABASE_SERVICE_ROLE_KEY must be the service_role / sb_secret key"
            : "cannot reach Supabase — check SUPABASE_URL",
      };
    }
  }
  return json({
    ok: missing.length === 0 && database.ok,
    missing,
    database,
    appUrl: env.appUrl,
    testMode: isTestMode(),
  });
}
