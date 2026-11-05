import "server-only";
import { env, missingCoreEnv } from "./env";
import { MemoryRepo } from "./db/memory-repo";
import { SupabaseRepo } from "./db/supabase-repo";
import type { Repo } from "./db/types";
import { FakeDrive } from "./drive/fake-drive";

/**
 * Test backends (in-memory DB + fake Drive) are ONLY available when
 * VTR_TEST_BACKENDS=1 and the app is not running on Cloudflare Workers (or Vercel). They exist so the
 * automated E2E suite can run without real credentials. The UI shows a
 * prominent "TEST MODE" banner whenever they are active.
 */
export function isCloudflareWorker(): boolean {
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

export function isTestMode(): boolean {
  if (process.env.VTR_TEST_BACKENDS !== "1" || process.env.VERCEL) return false;
  if (!isCloudflareWorker()) return true;
  // Local `wrangler dev` E2E run only: needs a second flag AND a plain-http localhost URL,
  // which can never be true for a real (https) Cloudflare deployment.
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "";
  return process.env.VTR_TEST_ALLOW_WORKERD === "1" && /^http:\/\/localhost(:\d+)?$/.test(appUrl);
}

const g = globalThis as unknown as { __vtrRepo?: Repo; __vtrFakeDrive?: FakeDrive };

export class NotConfiguredError extends Error {
  constructor(public missing: string[]) {
    super(`ระบบยังไม่ได้ตั้งค่า: ${missing.join(", ")}`);
  }
}

export function getRepo(): Repo {
  if (g.__vtrRepo) return g.__vtrRepo;
  if (isTestMode()) {
    g.__vtrRepo = MemoryRepo.seeded();
    return g.__vtrRepo;
  }
  const missing = missingCoreEnv().filter((m) => m.startsWith("SUPABASE"));
  if (missing.length) throw new NotConfiguredError(missing);
  g.__vtrRepo = new SupabaseRepo(env.supabaseUrl, env.supabaseServiceRoleKey);
  return g.__vtrRepo;
}

export function getFakeDrive(): FakeDrive {
  if (!isTestMode()) throw new Error("FakeDrive is only available in test mode");
  g.__vtrFakeDrive ??= new FakeDrive();
  return g.__vtrFakeDrive;
}

/** Test helper: swap backends (used by Vitest integration tests). */
export function __setTestBackends(repo: Repo | undefined, drive: FakeDrive | undefined) {
  g.__vtrRepo = repo;
  g.__vtrFakeDrive = drive;
}
