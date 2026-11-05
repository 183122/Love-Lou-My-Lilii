/**
 * Integration-test harness: runs real Route Handlers against the in-memory
 * repo + FakeDrive, with a mocked cookie jar for next/headers.
 */
import { vi } from "vitest";

export const cookieJar = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    set: (name: string, value: string) => void cookieJar.set(name, value),
    delete: (name: string) => void cookieJar.delete(name),
  }),
}));

import { __setTestBackends } from "@/lib/server/backends";
import { MemoryRepo } from "@/lib/server/db/memory-repo";
import { FakeDrive } from "@/lib/server/drive/fake-drive";
import { hashPassword } from "@/lib/server/crypto";

export const ORIGIN = "http://localhost:3000";
export const ADMIN_PASSWORD = "correct horse battery staple";

export async function setup() {
  process.env.VTR_TEST_BACKENDS = "1";
  process.env.SESSION_SECRET = "test-session-secret-0123456789abcdef0123456789";
  process.env.NEXT_PUBLIC_APP_URL = ORIGIN;
  process.env.ADMIN_PASSWORD_HASH ||= await hashPassword(ADMIN_PASSWORD);
  delete process.env.VERCEL;
  const repo = MemoryRepo.seeded();
  const drive = new FakeDrive();
  __setTestBackends(repo, drive);
  cookieJar.clear();
  return { repo, drive };
}

export function req(path: string, init: RequestInit & { json?: unknown; csrf?: string } = {}) {
  const headers = new Headers(init.headers);
  headers.set("host", "localhost:3000");
  if (init.method && init.method !== "GET") headers.set("origin", ORIGIN);
  if (init.json !== undefined) headers.set("content-type", "application/json");
  if (init.csrf) headers.set("x-csrf-token", init.csrf);
  headers.set("x-forwarded-for", "203.0.113.7");
  return new Request(`${ORIGIN}${path}`, {
    ...init,
    headers,
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
  });
}

export const ctx = <T extends Record<string, string>>(params: T) => ({ params: Promise.resolve(params) });

/** Minimal valid file headers (magic bytes) padded to size. */
export function fakeJpeg(size = 1000) {
  const b = new Uint8Array(size);
  b.set([0xff, 0xd8, 0xff, 0xe0]);
  return b;
}
export function fakePng(size = 1000) {
  const b = new Uint8Array(size);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return b;
}
export function fakeMp4(size = 1000) {
  const b = new Uint8Array(size);
  b.set([0, 0, 0, 0x18, ...Array.from("ftypisom", (c) => c.charCodeAt(0))]);
  return b;
}
