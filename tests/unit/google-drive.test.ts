import { describe, expect, it, vi } from "vitest";
import { assertGoogleUploadUrl, buildAuthUrl, escapeDriveQuery, exchangeCode, GoogleDriveClient } from "@/lib/server/drive/google-drive";
import { DriveError } from "@/lib/server/drive/types";

/** Builds a fetch mock that routes by URL/method and records calls. Mocks are used ONLY in automated tests. */
function mockFetch(routes: Array<(url: string, init: RequestInit) => Response | undefined>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    calls.push({ url, init });
    for (const r of routes) {
      const res = r(url, init);
      if (res) return res;
    }
    return new Response("unmocked", { status: 500 });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const tokenOk = (url: string) =>
  url.includes("oauth2.googleapis.com/token") ? Response.json({ access_token: "ya29.test", expires_in: 3600 }) : undefined;

function client(fetchImpl: typeof fetch) {
  return new GoogleDriveClient({ clientId: "cid", clientSecret: "secret", refreshToken: "1//rt", fetchImpl });
}

describe("GoogleDriveClient", () => {
  it("refreshes access token once and caches it; sends Bearer header", async () => {
    const m = mockFetch([tokenOk, (u) => (u.includes("/about") ? Response.json({ user: { emailAddress: "a@school.ac.th" } }) : undefined)]);
    const c = client(m.fn);
    expect((await c.about()).email).toBe("a@school.ac.th");
    await c.about();
    expect(m.calls.filter((x) => x.url.includes("/token"))).toHaveLength(1);
    const about = m.calls.find((x) => x.url.includes("/about"))!;
    expect(new Headers(about.init.headers).get("authorization")).toBe("Bearer ya29.test");
    // refresh token is sent only to Google's token endpoint
    expect(m.calls.filter((x) => String(x.init.body ?? "").includes("1//rt")).every((x) => x.url.startsWith("https://oauth2.googleapis.com/"))).toBe(true);
  });

  // Test 26: expired / revoked token
  it("maps invalid_grant to TOKEN_REVOKED with a reconnect hint", async () => {
    const m = mockFetch([(u) => (u.includes("/token") ? Response.json({ error: "invalid_grant" }, { status: 400 }) : undefined)]);
    const err = await client(m.fn).about().catch((e) => e);
    expect(err).toBeInstanceOf(DriveError);
    expect(err.code).toBe("TOKEN_REVOKED");
    expect(err.message).toContain("เชื่อมต่อใหม่");
  });

  it("retries once with a fresh access token on 401", async () => {
    let n = 0;
    const m = mockFetch([
      tokenOk,
      (u) => (u.includes("/about") ? (n++ === 0 ? new Response("", { status: 401 }) : Response.json({ user: { emailAddress: "x" } })) : undefined),
    ]);
    expect((await client(m.fn).about()).email).toBe("x");
    expect(m.calls.filter((x) => x.url.includes("/token"))).toHaveLength(2);
  });

  // Test 27: no write permission
  it("maps 403 insufficientFilePermissions to FORBIDDEN", async () => {
    const m = mockFetch([
      tokenOk,
      (u, i) =>
        u.includes("/files?fields=id") && i.method === "POST"
          ? Response.json({ error: { errors: [{ reason: "insufficientFilePermissions" }] } }, { status: 403 })
          : undefined,
    ]);
    const err = await client(m.fn).createFolder("x", "parent").catch((e) => e);
    expect(err.code).toBe("FORBIDDEN");
    expect(err.message).toContain("ไม่มีสิทธิ์เขียน");
  });

  it("maps storage quota 403 to QUOTA", async () => {
    const m = mockFetch([
      tokenOk,
      (u) => (u.includes("uploadType=resumable") ? Response.json({ error: { errors: [{ reason: "storageQuotaExceeded" }] } }, { status: 403 }) : undefined),
    ]);
    const err = await client(m.fn).initResumableUpload({ name: "a", mimeType: "image/png", parentId: "p", size: 1 }).catch((e) => e);
    expect(err.code).toBe("QUOTA");
  });

  // Test 10/11 at protocol level
  it("creates folders with the folder MIME type and parent", async () => {
    const m = mockFetch([tokenOk, (u, i) => (i.method === "POST" && u.includes("/drive/v3/files?") ? Response.json({ id: "fld1" }) : undefined)]);
    expect(await client(m.fn).createFolder("A01 ประชุมครู", "root1")).toBe("fld1");
    const body = JSON.parse(String(m.calls.at(-1)!.init.body));
    expect(body).toEqual({ name: "A01 ประชุมครู", mimeType: "application/vnd.google-apps.folder", parents: ["root1"] });
  });

  it("escapes names in folder search queries", async () => {
    expect(escapeDriveQuery("ครู's \\ test")).toBe("ครู\\'s \\\\ test");
    const m = mockFetch([tokenOk, (u) => (u.includes("/drive/v3/files?q=") ? Response.json({ files: [{ id: "existing" }] }) : undefined)]);
    expect(await client(m.fn).findFolder("it's", "root")).toBe("existing");
    expect(decodeURIComponent(m.calls.at(-1)!.url)).toContain("name = 'it\\'s'");
  });

  it("starts a resumable session and uploads chunks with Content-Range", async () => {
    const session = "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=XYZ";
    const m = mockFetch([
      tokenOk,
      (u, i) =>
        u.includes("uploadType=resumable&supportsAllDrives") && i.method === "POST"
          ? new Response(null, { status: 200, headers: { location: session } })
          : undefined,
      (u, i) => {
        if (u !== session || i.method !== "PUT") return undefined;
        const range = new Headers(i.headers).get("content-range")!;
        if (range === "bytes 0-262143/300000") return new Response(null, { status: 308, headers: { range: "bytes=0-262143" } });
        if (range === "bytes 262144-299999/300000") return Response.json({ id: "drive-file-1", md5Checksum: "abc" });
        if (range === "bytes */300000") return new Response(null, { status: 308, headers: { range: "bytes=0-262143" } });
        return new Response("bad", { status: 400 });
      },
    ]);
    const c = client(m.fn);
    const url = await c.initResumableUpload({ name: "a.mp4", mimeType: "video/mp4", parentId: "p", size: 300000 });
    expect(url).toBe(session);
    const init = m.calls.find((x) => x.url.includes("supportsAllDrives") && x.init.method === "POST")!;
    expect(new Headers(init.init.headers).get("x-upload-content-length")).toBe("300000");
    expect(await c.uploadChunk(url, new Uint8Array(262144), 0, 300000)).toEqual({ done: false, committed: 262144 });
    expect(await c.queryUploadStatus(url, 300000)).toEqual({ done: false, committed: 262144 });
    expect(await c.uploadChunk(url, new Uint8Array(300000 - 262144), 262144, 300000)).toEqual({
      done: true,
      file: { id: "drive-file-1", md5Checksum: "abc" },
    });
  });

  it("reports an expired resumable session (404) as SESSION_EXPIRED", async () => {
    const session = "https://www.googleapis.com/upload/drive/v3/files?upload_id=OLD";
    const m = mockFetch([tokenOk, (u) => (u === session ? new Response("", { status: 404 }) : undefined)]);
    const err = await client(m.fn).uploadChunk(session, new Uint8Array(10), 0, 10).catch((e) => e);
    expect(err.code).toBe("SESSION_EXPIRED");
  });

  it("reports network failures as NETWORK (retryable)", async () => {
    const fn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    const err = await client(fn).about().catch((e) => e);
    expect(err.code).toBe("NETWORK");
  });

  it("getFile returns null on 404 (file deleted in Drive)", async () => {
    const m = mockFetch([tokenOk, (u) => (u.includes("/files/gone") ? new Response("", { status: 404 }) : undefined)]);
    expect(await client(m.fn).getFile("gone")).toBeNull();
  });

  it("refuses to send data to non-Google upload URLs", () => {
    expect(() => assertGoogleUploadUrl("https://evil.example.com/upload/drive/v3/x")).toThrow();
    expect(() => assertGoogleUploadUrl("https://www.googleapis.com/upload/drive/v3/files?upload_id=1")).not.toThrow();
  });

  it("forwards Range header for video streaming", async () => {
    const m = mockFetch([tokenOk, (u) => (u.includes("alt=media") ? new Response("abc", { status: 206 }) : undefined)]);
    const res = await client(m.fn).download("f1", "bytes=0-2");
    expect(res.status).toBe(206);
    expect(new Headers(m.calls.at(-1)!.init.headers).get("range")).toBe("bytes=0-2");
  });
});

describe("OAuth helpers", () => {
  it("builds an offline consent URL with minimal scope", () => {
    const u = new URL(buildAuthUrl({ clientId: "cid", redirectUri: "https://x/cb", scope: "https://www.googleapis.com/auth/drive.file", state: "st" }));
    expect(u.searchParams.get("access_type")).toBe("offline");
    expect(u.searchParams.get("prompt")).toBe("consent");
    expect(u.searchParams.get("scope")).toBe("https://www.googleapis.com/auth/drive.file openid email");
    expect(u.searchParams.get("state")).toBe("st");
  });
  it("errors helpfully when Google omits the refresh token", async () => {
    const fetchImpl = (async () => Response.json({ access_token: "a", scope: "drive.file" })) as unknown as typeof fetch;
    const err = await exchangeCode({ clientId: "c", clientSecret: "s", redirectUri: "r", code: "x", fetchImpl }).catch((e) => e);
    expect(err.detail).toContain("refresh token");
  });
});
