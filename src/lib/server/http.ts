import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { NotConfiguredError } from "./backends";
import { RepoError } from "./db/types";
import { DriveError } from "./drive/types";
import { env } from "./env";
import { sha256 } from "./crypto";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "ERROR",
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function json(data: unknown, init?: ResponseInit) {
  const res = NextResponse.json(data, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/** Convert any thrown error into a safe JSON response (no stack traces / secrets leak to clients). */
export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return json({ error: e.message, code: e.code, ...e.extra }, { status: e.status });
  if (e instanceof ZodError) {
    const first = e.issues[0];
    return json(
      { error: first?.message ?? "ข้อมูลไม่ถูกต้อง", code: "VALIDATION", field: first?.path.join(".") },
      { status: 400 },
    );
  }
  if (e instanceof DriveError) {
    console.error("[drive]", e.code, e.httpStatus, e.detail);
    const status = e.code === "NOT_FOUND" ? 404 : e.code === "NETWORK" || e.code === "QUOTA" ? 503 : 502;
    return json({ error: e.message, code: `DRIVE_${e.code}` }, { status });
  }
  if (e instanceof NotConfiguredError) {
    return json({ error: e.message, code: "NOT_CONFIGURED", missing: e.missing }, { status: 503 });
  }
  if (e instanceof RepoError) {
    console.error("[db]", e.message);
    return json(
      { error: e.code === "CONFLICT" ? e.message : "เกิดข้อผิดพลาดของฐานข้อมูล", code: `DB_${e.code}` },
      { status: e.code === "CONFLICT" ? 409 : 500 },
    );
  }
  console.error("[unhandled]", e);
  return json({ error: "เกิดข้อผิดพลาดภายในระบบ กรุณาลองใหม่", code: "INTERNAL" }, { status: 500 });
}

export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  return (xf?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "unknown").trim();
}

export function ipHash(req: Request): string {
  return sha256(`${env.sessionSecret}:${clientIp(req)}`).slice(0, 32);
}

/** Reject cross-site state-changing requests (defence in depth on top of CSRF tokens). */
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin) {
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin" && site !== "none") throw new HttpError(403, "คำขอข้ามโดเมนถูกปฏิเสธ", "BAD_ORIGIN");
    return;
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let ok = false;
  try {
    const o = new URL(origin);
    ok = o.host === host || origin === env.appUrl;
  } catch {
    ok = false;
  }
  if (!ok) throw new HttpError(403, "คำขอข้ามโดเมนถูกปฏิเสธ", "BAD_ORIGIN");
}

export async function readJson<T = unknown>(req: Request, maxBytes = 64 * 1024): Promise<T> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) throw new HttpError(413, "ข้อมูลมีขนาดใหญ่เกินไป", "TOO_LARGE");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "ข้อมูลมีขนาดใหญ่เกินไป", "TOO_LARGE");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "รูปแบบข้อมูลไม่ถูกต้อง", "BAD_JSON");
  }
}
