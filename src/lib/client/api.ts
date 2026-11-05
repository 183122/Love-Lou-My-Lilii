"use client";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public data: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

let csrfToken: string | null = null;
export function setCsrfToken(t: string | null) {
  csrfToken = t;
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.json !== undefined) headers.set("Content-Type", "application/json");
  if (csrfToken && init.method && init.method !== "GET") headers.set("x-csrf-token", csrfToken);
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต", 0, "NETWORK");
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(String(body.error ?? `เกิดข้อผิดพลาด (${res.status})`), res.status, String(body.code ?? "ERROR"), body);
  return body as T;
}
