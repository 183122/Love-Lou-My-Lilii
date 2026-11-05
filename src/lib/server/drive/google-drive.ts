import { DriveError, type ChunkResult, type DriveClient, type DriveFileMeta } from "./types";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const FOLDER_MIME = "application/vnd.google-apps.folder";

type FetchLike = typeof fetch;

export interface GoogleDriveOptions {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetchImpl?: FetchLike;
}

/** Escape a value for use inside a Drive `q` string literal. */
export function escapeDriveQuery(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Minimal Google Drive v3 REST client (no SDK) used server-side only.
 * The refresh token never leaves this process; access tokens are cached in memory.
 */
export class GoogleDriveClient implements DriveClient {
  readonly kind = "google" as const;
  private accessToken: { value: string; expiresAt: number } | null = null;
  private fetchImpl: FetchLike;

  constructor(private opts: GoogleDriveOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async net(input: string, init: RequestInit): Promise<Response> {
    try {
      return await this.fetchImpl(input, { ...init, cache: "no-store" });
    } catch (e) {
      throw new DriveError("NETWORK", e instanceof Error ? e.message : String(e));
    }
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) return this.accessToken.value;
    const res = await this.net(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.opts.clientId,
        client_secret: this.opts.clientSecret,
        refresh_token: this.opts.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string };
    if (!res.ok || !body.access_token) {
      if (body.error === "invalid_grant" || body.error === "unauthorized_client")
        throw new DriveError("TOKEN_REVOKED", body.error, res.status);
      if (body.error === "invalid_client") throw new DriveError("NOT_CONFIGURED", body.error, res.status);
      throw new DriveError(res.status >= 500 ? "NETWORK" : "UNKNOWN", body.error, res.status);
    }
    this.accessToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
    return body.access_token;
  }

  private async authed(url: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const token = await this.getAccessToken();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    const res = await this.net(url, { ...init, headers });
    if (res.status === 401 && retry) {
      this.accessToken = null;
      return this.authed(url, init, false);
    }
    return res;
  }

  private async raise(res: Response): Promise<never> {
    const text = await res.text().catch(() => "");
    let reason = "";
    try {
      reason = JSON.parse(text)?.error?.errors?.[0]?.reason ?? JSON.parse(text)?.error?.status ?? "";
    } catch {
      /* not json */
    }
    if (res.status === 401) throw new DriveError("TOKEN_REVOKED", text.slice(0, 300), 401);
    if (res.status === 404) throw new DriveError("NOT_FOUND", text.slice(0, 300), 404);
    if (res.status === 403) {
      if (/quota|rateLimit|storage/i.test(reason)) throw new DriveError("QUOTA", reason, 403);
      throw new DriveError("FORBIDDEN", reason || text.slice(0, 300), 403);
    }
    if (res.status === 429) throw new DriveError("QUOTA", "rate limited", 429);
    if (res.status >= 500) throw new DriveError("NETWORK", text.slice(0, 300), res.status);
    throw new DriveError("UNKNOWN", text.slice(0, 300), res.status);
  }

  async about() {
    const res = await this.authed(`${API}/about?fields=user(emailAddress,displayName)`);
    if (!res.ok) await this.raise(res);
    const body = (await res.json()) as { user?: { emailAddress?: string; displayName?: string } };
    return { email: body.user?.emailAddress ?? "", name: body.user?.displayName ?? "" };
  }

  async getFile(id: string): Promise<DriveFileMeta | null> {
    const fields = "id,name,mimeType,size,md5Checksum,trashed,parents,thumbnailLink,webViewLink,capabilities(canAddChildren,canEdit)";
    const res = await this.authed(`${API}/files/${encodeURIComponent(id)}?fields=${fields}&supportsAllDrives=true`);
    if (res.status === 404) return null;
    if (!res.ok) await this.raise(res);
    return (await res.json()) as DriveFileMeta;
  }

  async findFolder(name: string, parentId: string) {
    const q = `name = '${escapeDriveQuery(name)}' and '${escapeDriveQuery(parentId)}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`;
    const res = await this.authed(
      `${API}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=10&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    );
    if (!res.ok) await this.raise(res);
    const body = (await res.json()) as { files?: { id: string }[] };
    return body.files?.[0]?.id ?? null;
  }

  async createFolder(name: string, parentId: string | null) {
    const res = await this.authed(`${API}/files?fields=id&supportsAllDrives=true`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
    });
    if (!res.ok) await this.raise(res);
    return ((await res.json()) as { id: string }).id;
  }

  async initResumableUpload(input: { name: string; mimeType: string; parentId: string; size: number }) {
    const res = await this.authed(
      `${UPLOAD_API}/files?uploadType=resumable&supportsAllDrives=true&fields=id,md5Checksum,size`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Type": input.mimeType,
          "X-Upload-Content-Length": String(input.size),
        },
        body: JSON.stringify({ name: input.name, parents: [input.parentId], mimeType: input.mimeType }),
      },
    );
    if (!res.ok) await this.raise(res);
    const location = res.headers.get("location");
    if (!location) throw new DriveError("UNKNOWN", "missing resumable session location");
    return location;
  }

  private async parseChunkResponse(res: Response): Promise<ChunkResult> {
    if (res.status === 308) {
      const range = res.headers.get("range"); // e.g. "bytes=0-3932159"
      const m = range?.match(/bytes=0-(\d+)/);
      return { done: false, committed: m ? Number(m[1]) + 1 : 0 };
    }
    if (res.status === 200 || res.status === 201) {
      const body = (await res.json()) as { id: string; md5Checksum?: string };
      if (!body.id) throw new DriveError("UNKNOWN", "upload completed without file id");
      return { done: true, file: { id: body.id, md5Checksum: body.md5Checksum } };
    }
    if (res.status === 404 || res.status === 410) throw new DriveError("SESSION_EXPIRED", undefined, res.status);
    return this.raise(res);
  }

  async uploadChunk(sessionUrl: string, chunk: Uint8Array, start: number, total: number) {
    assertGoogleUploadUrl(sessionUrl);
    const end = start + chunk.byteLength - 1;
    const res = await this.authed(sessionUrl, {
      method: "PUT",
      headers: { "Content-Length": String(chunk.byteLength), "Content-Range": `bytes ${start}-${end}/${total}` },
      body: chunk as unknown as BodyInit,
    });
    return this.parseChunkResponse(res);
  }

  async queryUploadStatus(sessionUrl: string, total: number) {
    assertGoogleUploadUrl(sessionUrl);
    const res = await this.authed(sessionUrl, {
      method: "PUT",
      headers: { "Content-Length": "0", "Content-Range": `bytes */${total}` },
    });
    return this.parseChunkResponse(res);
  }

  async download(id: string, range?: string | null) {
    const headers: Record<string, string> = {};
    if (range && /^bytes=\d*-\d*$/.test(range)) headers.Range = range;
    const res = await this.authed(`${API}/files/${encodeURIComponent(id)}?alt=media&supportsAllDrives=true`, { headers });
    if (!res.ok && res.status !== 206) await this.raise(res);
    return res;
  }

  async thumbnail(id: string) {
    const meta = await this.getFile(id);
    if (!meta) throw new DriveError("NOT_FOUND");
    if (!meta.thumbnailLink) return null;
    const res = await this.authed(meta.thumbnailLink);
    return res.ok ? res : null;
  }

  async trash(id: string) {
    const res = await this.authed(`${API}/files/${encodeURIComponent(id)}?supportsAllDrives=true`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
    if (res.status === 404) return;
    if (!res.ok) await this.raise(res);
  }
}

/** Only ever send chunks to Google's upload host (defence against a tampered DB value). */
export function assertGoogleUploadUrl(url: string) {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.hostname !== "www.googleapis.com" || !u.pathname.startsWith("/upload/drive/")) {
    throw new DriveError("UNKNOWN", "refusing non-Google upload session URL");
  }
}

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------
export function buildAuthUrl(opts: { clientId: string; redirectUri: string; scope: string; state: string }) {
  const p = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: `${opts.scope} openid email`,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: opts.state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export async function exchangeCode(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  fetchImpl?: FetchLike;
}): Promise<{ refreshToken: string; scope: string }> {
  const res = await (opts.fetchImpl ?? fetch)(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      redirect_uri: opts.redirectUri,
      code: opts.code,
      grant_type: "authorization_code",
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { refresh_token?: string; scope?: string; error?: string };
  if (!res.ok) throw new DriveError("UNKNOWN", body.error ?? `token exchange failed (${res.status})`, res.status);
  if (!body.refresh_token)
    throw new DriveError(
      "UNKNOWN",
      "Google ไม่ส่ง refresh token กลับมา — ให้เพิกถอนสิทธิ์แอปที่ https://myaccount.google.com/permissions แล้วเชื่อมต่อใหม่",
    );
  return { refreshToken: body.refresh_token, scope: body.scope ?? "" };
}

export async function revokeToken(token: string, fetchImpl: FetchLike = fetch) {
  await fetchImpl(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(
    () => undefined,
  );
}
