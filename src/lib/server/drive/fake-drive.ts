import { randomUUID, createHash } from "node:crypto";
import { DriveError, type ChunkResult, type DriveClient, type DriveFileMeta } from "./types";

interface FakeNode {
  id: string;
  name: string;
  mimeType: string;
  parentId: string | null;
  data?: Uint8Array;
  trashed: boolean;
}

/**
 * In-memory Google Drive stand-in for AUTOMATED TESTS ONLY.
 * Supports failure injection to exercise error paths (expired token,
 * missing write permission, network drop mid-upload, deleted files).
 */
export class FakeDrive implements DriveClient {
  readonly kind = "fake" as const;
  nodes = new Map<string, FakeNode>();
  sessions = new Map<string, { name: string; mimeType: string; parentId: string; size: number; buf: Uint8Array; got: number }>();
  failures = {
    tokenRevoked: false,
    forbidden: false,
    /** number of upcoming uploadChunk calls that throw a network error */
    networkDropChunks: 0,
    /** number of upcoming uploadChunk calls whose session is reported expired */
    expireSessions: 0,
  };
  calls = { createFolder: 0, initResumable: 0, uploadChunk: 0 };

  constructor() {
    this.nodes.set("fake-root-parent", {
      id: "fake-root-parent",
      name: "My Drive",
      mimeType: "application/vnd.google-apps.folder",
      parentId: null,
      trashed: false,
    });
  }

  private guard() {
    if (this.failures.tokenRevoked) throw new DriveError("TOKEN_REVOKED", "invalid_grant", 400);
  }
  private guardWrite() {
    this.guard();
    if (this.failures.forbidden) throw new DriveError("FORBIDDEN", "insufficientFilePermissions", 403);
  }

  async about() {
    this.guard();
    return { email: "test-drive@example.invalid", name: "Fake Drive (test)" };
  }

  async getFile(id: string): Promise<DriveFileMeta | null> {
    this.guard();
    const n = this.nodes.get(id);
    if (!n) return null;
    return {
      id: n.id,
      name: n.name,
      mimeType: n.mimeType,
      size: n.data ? String(n.data.byteLength) : undefined,
      trashed: n.trashed,
      parents: n.parentId ? [n.parentId] : [],
      capabilities: { canAddChildren: !this.failures.forbidden, canEdit: !this.failures.forbidden },
      webViewLink: `https://drive.google.com/file/d/${n.id}/view`,
    };
  }

  async findFolder(name: string, parentId: string) {
    this.guard();
    for (const n of this.nodes.values())
      if (n.name === name && n.parentId === parentId && !n.trashed && n.mimeType.endsWith("folder")) return n.id;
    return null;
  }

  async createFolder(name: string, parentId: string | null) {
    this.guardWrite();
    this.calls.createFolder++;
    const id = `fld_${randomUUID()}`;
    this.nodes.set(id, { id, name, parentId, mimeType: "application/vnd.google-apps.folder", trashed: false });
    return id;
  }

  async initResumableUpload(input: { name: string; mimeType: string; parentId: string; size: number }) {
    this.guardWrite();
    if (!this.nodes.has(input.parentId)) throw new DriveError("NOT_FOUND", "parent", 404);
    this.calls.initResumable++;
    const sid = randomUUID();
    this.sessions.set(sid, { ...input, buf: new Uint8Array(input.size), got: 0 });
    return `https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=${sid}`;
  }

  private sid(url: string) {
    return new URL(url).searchParams.get("upload_id") ?? "";
  }

  async uploadChunk(sessionUrl: string, chunk: Uint8Array, start: number, total: number): Promise<ChunkResult> {
    this.guardWrite();
    this.calls.uploadChunk++;
    if (this.failures.networkDropChunks > 0) {
      this.failures.networkDropChunks--;
      throw new DriveError("NETWORK", "simulated network drop");
    }
    const id = this.sid(sessionUrl);
    const s = this.sessions.get(id);
    if (!s || this.failures.expireSessions > 0) {
      if (this.failures.expireSessions > 0) this.failures.expireSessions--;
      this.sessions.delete(id);
      throw new DriveError("SESSION_EXPIRED", undefined, 404);
    }
    if (total !== s.size) throw new DriveError("UNKNOWN", "size mismatch", 400);
    if (start !== s.got) return { done: false, committed: s.got };
    s.buf.set(chunk, start);
    s.got = start + chunk.byteLength;
    if (s.got < s.size) return { done: false, committed: s.got };
    return this.finish(id);
  }

  private finish(id: string): ChunkResult {
    const s = this.sessions.get(id)!;
    const fileId = `file_${randomUUID()}`;
    this.nodes.set(fileId, { id: fileId, name: s.name, mimeType: s.mimeType, parentId: s.parentId, data: s.buf, trashed: false });
    this.sessions.delete(id);
    return { done: true, file: { id: fileId, md5Checksum: createHash("md5").update(s.buf).digest("hex") } };
  }

  async queryUploadStatus(sessionUrl: string): Promise<ChunkResult> {
    this.guard();
    const s = this.sessions.get(this.sid(sessionUrl));
    if (!s) throw new DriveError("SESSION_EXPIRED", undefined, 404);
    return { done: false, committed: s.got };
  }

  async download(id: string, range?: string | null) {
    this.guard();
    const n = this.nodes.get(id);
    if (!n || !n.data || n.trashed) throw new DriveError("NOT_FOUND", undefined, 404);
    const m = range?.match(/^bytes=(\d*)-(\d*)$/);
    if (m) {
      const start = m[1] ? Number(m[1]) : 0;
      const end = m[2] ? Math.min(Number(m[2]), n.data.byteLength - 1) : n.data.byteLength - 1;
      return new Response(n.data.slice(start, end + 1) as unknown as BodyInit, {
        status: 206,
        headers: {
          "content-type": n.mimeType,
          "content-length": String(end - start + 1),
          "content-range": `bytes ${start}-${end}/${n.data.byteLength}`,
        },
      });
    }
    return new Response(n.data as unknown as BodyInit, {
      headers: { "content-type": n.mimeType, "content-length": String(n.data.byteLength) },
    });
  }

  async thumbnail(id: string) {
    this.guard();
    const n = this.nodes.get(id);
    if (!n || n.trashed) throw new DriveError("NOT_FOUND", undefined, 404);
    return null;
  }

  async trash(id: string) {
    this.guardWrite();
    const n = this.nodes.get(id);
    if (n) n.trashed = true;
  }

  /** Test helper: simulate a file being removed directly in Google Drive. */
  removeExternally(id: string) {
    this.nodes.delete(id);
  }
}
