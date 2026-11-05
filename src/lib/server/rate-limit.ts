import "server-only";
import { getRepo } from "./backends";
import { HttpError, ipHash } from "./http";

export const LIMITS = {
  login: { limit: 5, window: 15 * 60 },
  viewer: { limit: 10, window: 15 * 60 },
  submission: { limit: 15, window: 60 * 60 },
  chunk: { limit: 3000, window: 60 * 60 },
  fileRead: { limit: 1500, window: 60 * 60 },
} as const;

export async function enforceRateLimit(req: Request, name: keyof typeof LIMITS, extraKey = "") {
  const { limit, window } = LIMITS[name];
  const ok = await getRepo().rateLimitHit(`${name}:${ipHash(req)}${extraKey ? `:${extraKey}` : ""}`, limit, window);
  if (!ok) {
    throw new HttpError(429, "มีการเรียกใช้งานถี่เกินไป กรุณารอสักครู่แล้วลองใหม่", "RATE_LIMITED", {
      retryAfterSeconds: window,
    });
  }
}
