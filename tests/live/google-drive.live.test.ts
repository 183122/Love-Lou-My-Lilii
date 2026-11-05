/**
 * REAL Google Drive integration test (no mocks). Run with:
 *   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=... npm run test:drive-live
 * It creates a temporary folder, uploads a 2-chunk file with the resumable
 * protocol used in production, downloads it with Range, then trashes everything.
 * Skipped (and reported as skipped) when credentials are absent.
 */
import { describe, expect, it } from "vitest";
import { GoogleDriveClient } from "@/lib/server/drive/google-drive";
import { CHUNK_SIZE } from "@/lib/shared/files";

const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;
const enabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET && GOOGLE_REFRESH_TOKEN);

describe.skipIf(!enabled)("Google Drive (live)", () => {
  const drive = new GoogleDriveClient({
    clientId: GOOGLE_CLIENT_ID!,
    clientSecret: GOOGLE_CLIENT_SECRET!,
    refreshToken: GOOGLE_REFRESH_TOKEN!,
  });

  it("connects, creates folder, resumable-uploads, downloads with Range, trashes", async () => {
    const me = await drive.about();
    expect(me.email).toContain("@");

    const folder = await drive.createFolder(`VTR_live_test_${Date.now()}`, null);
    try {
      expect(await drive.findFolder((await drive.getFile(folder))!.name, "root")).toBe(folder);
      const size = CHUNK_SIZE + 1000;
      const data = new Uint8Array(size);
      data.set([0xff, 0xd8, 0xff, 0xe0]);
      for (let i = 4; i < size; i++) data[i] = i % 251;

      const session = await drive.initResumableUpload({ name: "live.jpg", mimeType: "image/jpeg", parentId: folder, size });
      const first = await drive.uploadChunk(session, data.subarray(0, CHUNK_SIZE), 0, size);
      expect(first).toEqual({ done: false, committed: CHUNK_SIZE });
      expect(await drive.queryUploadStatus(session, size)).toEqual({ done: false, committed: CHUNK_SIZE });
      const last = await drive.uploadChunk(session, data.subarray(CHUNK_SIZE), CHUNK_SIZE, size);
      expect(last.done).toBe(true);
      const fileId = last.done ? last.file.id : "";

      const meta = await drive.getFile(fileId);
      expect(meta?.parents).toContain(folder);
      expect(Number(meta?.size)).toBe(size);

      const part = await drive.download(fileId, "bytes=0-3");
      expect(part.status).toBe(206);
      expect([...new Uint8Array(await part.arrayBuffer())]).toEqual([0xff, 0xd8, 0xff, 0xe0]);
      await drive.trash(fileId);
    } finally {
      await drive.trash(folder);
    }
  });
});

describe.skipIf(enabled)("Google Drive (live) — credentials missing", () => {
  it.skip("set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN to run", () => {});
});
