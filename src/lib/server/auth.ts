import "server-only";
import { cookies } from "next/headers";
import type { SessionRole } from "@/lib/shared/types";
import { getRepo } from "./backends";
import { randomToken, safeEqual, sha256 } from "./crypto";
import { env } from "./env";
import { assertSameOrigin, HttpError } from "./http";

export const SESSION_COOKIE = "vtr_session";
const TTL: Record<SessionRole, number> = { ADMIN: 8 * 3600, VIEWER: 7 * 24 * 3600 };

export interface Session {
  id: string;
  role: SessionRole;
  csrfToken: string;
  expiresAt: string;
}

function cookieName() {
  // __Host- prefix requires Secure + Path=/ and no Domain: strongest cookie scoping on HTTPS.
  return env.isProduction && env.appUrl.startsWith("https://") ? `__Host-${SESSION_COOKIE}` : SESSION_COOKIE;
}

export async function createSession(role: SessionRole, meta: { ipHash: string; userAgent: string }) {
  const token = randomToken(32);
  const csrf = randomToken(24);
  const expires = new Date(Date.now() + TTL[role] * 1000);
  const repo = getRepo();
  await repo.purgeExpiredSessions().catch(() => undefined);
  await repo.createSession({
    token_hash: sha256(token),
    role,
    csrf_token: csrf,
    expires_at: expires.toISOString(),
    ip_hash: meta.ipHash,
    user_agent: meta.userAgent.slice(0, 300),
  });
  const jar = await cookies();
  jar.set(cookieName(), token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    expires,
  });
  return { role, csrfToken: csrf, expiresAt: expires.toISOString() };
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(cookieName())?.value;
  if (!token || token.length > 200) return null;
  const row = await getRepo().getSessionByTokenHash(sha256(token));
  if (!row || new Date(row.expires_at).getTime() < Date.now()) return null;
  return { id: row.id, role: row.role, csrfToken: row.csrf_token, expiresAt: row.expires_at };
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(cookieName())?.value;
  if (token) await getRepo().deleteSessionByTokenHash(sha256(token));
  jar.delete(cookieName());
}

/**
 * Require a session with at least the given role. For non-GET requests also
 * enforces same-origin + CSRF token (header `x-csrf-token`).
 */
export async function requireRole(req: Request, role: SessionRole): Promise<Session> {
  const s = await getSession();
  if (!s) throw new HttpError(401, "กรุณาเข้าสู่ระบบ", "UNAUTHENTICATED");
  if (role === "ADMIN" && s.role !== "ADMIN") throw new HttpError(403, "ต้องเป็นผู้ดูแลระบบเท่านั้น", "FORBIDDEN");
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    assertSameOrigin(req);
    const header = req.headers.get("x-csrf-token") ?? "";
    if (!safeEqual(header, s.csrfToken)) throw new HttpError(403, "CSRF token ไม่ถูกต้อง กรุณารีเฟรชหน้า", "CSRF");
  }
  return s;
}
