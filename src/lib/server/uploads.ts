import "server-only";
import { CHUNK_SIZE, checkFileMeta, sanitizeFileName, sniffMatches, sniffMime } from "@/lib/shared/files";
import type { EvidenceFile, SubmissionStatus } from "@/lib/shared/types";
import type { z } from "zod";
import { getRepo } from "./backends";
import { signToken, verifyToken } from "./crypto";
import { DriveError } from "./drive/types";
import { ensureIndicatorFolder, getDrive } from "./drive/service";
import { env } from "./env";
import { HttpError } from "./http";
import { limitsFrom, loadSettings } from "./settings";
import type { submissionSchema } from "./validation";

const UPLOAD_TOKEN_TTL = 48 * 3600;
const SESSION_MAX_AGE_MS = 6 * 24 * 3600 * 1000; // Drive resumable sessions last ~1 week

export function uploadTokenFor(file: Pick<EvidenceFile, "id" | "submission_id">) {
  return signToken({ t: "up", f: file.id, s: file.submission_id }, env.sessionSecret, UPLOAD_TOKEN_TTL);
}

function checkUploadToken(fileId: string, token: string | null) {
  const data = token ? verifyToken<{ t: string; f: string; s: string }>(token, env.sessionSecret) : null;
  if (!data || data.t !== "up" || data.f !== fileId)
    throw new HttpError(401, "สิทธิ์การอัปโหลดหมดอายุหรือไม่ถูกต้อง กรุณาส่งหลักฐานใหม่", "BAD_UPLOAD_TOKEN");
  return data;
}

export interface CreatedSubmission {
  submissionId: string;
  chunkSize: number;
  reused: boolean;
  files: Array<{
    id: string;
    clientUploadId: string;
    uploadToken: string;
    status: EvidenceFile["status"];
    bytesUploaded: number;
  }>;
}

/**
 * Validate the form + file list, ensure the Drive folder exists, and create the
 * submission and evidence_files rows. Idempotent on clientUploadId: re-posting
 * the same files (e.g. after a network error) returns the existing records.
 */
export async function createSubmission(
  input: z.infer<typeof submissionSchema>,
  meta: { ipHash: string },
): Promise<CreatedSubmission> {
  const repo = getRepo();
  const settings = await loadSettings();
  const limits = limitsFrom(settings);

  const indicator = await repo.getIndicator(input.indicatorId);
  if (!indicator || !indicator.is_active) throw new HttpError(400, "ไม่พบตัวชี้วัดที่เลือก หรือถูกปิดใช้งาน", "BAD_INDICATOR");
  const category = (await repo.listCategories()).find((c) => c.id === indicator.category_id);
  if (!category?.is_active) throw new HttpError(400, "หมวดของตัวชี้วัดนี้ถูกปิดใช้งาน", "BAD_INDICATOR");

  if (input.files.length > limits.maxFiles)
    throw new HttpError(400, `แนบได้ไม่เกิน ${limits.maxFiles} ไฟล์ต่อการส่ง`, "TOO_MANY_FILES");
  const ids = new Set(input.files.map((f) => f.clientUploadId));
  if (ids.size !== input.files.length) throw new HttpError(400, "พบไฟล์ซ้ำในรายการ", "DUPLICATE_FILE");

  const checked = input.files.map((f) => {
    const r = checkFileMeta(f, limits);
    if (!r.ok) throw new HttpError(400, r.error, "BAD_FILE");
    return { ...f, mime: r.mime, mediaType: r.mediaType };
  });

  // Idempotency: same clientUploadIds already registered → return them.
  const existing = await repo.getFilesByClientUploadIds([...ids]);
  if (existing.length > 0) {
    const subIds = new Set(existing.map((f) => f.submission_id));
    if (existing.length !== ids.size || subIds.size !== 1)
      throw new HttpError(409, "รายการไฟล์นี้ถูกส่งไปแล้วบางส่วน กรุณาเลือกไฟล์ใหม่", "DUPLICATE_SUBMISSION");
    const submissionId = existing[0].submission_id;
    return {
      submissionId,
      chunkSize: CHUNK_SIZE,
      reused: true,
      files: existing.map((f) => ({
        id: f.id,
        clientUploadId: f.client_upload_id,
        uploadToken: uploadTokenFor(f),
        status: f.status,
        bytesUploaded: f.bytes_uploaded,
      })),
    };
  }

  // Fail early (before creating rows) if Drive is not usable, with an actionable message.
  await ensureIndicatorFolder(indicator.id);

  const submission = await repo.createSubmission({
    indicator_id: indicator.id,
    submitter_name: input.submitterName,
    submitter_position: input.submitterPosition,
    activity_title: input.activityTitle,
    activity_detail: input.activityDetail,
    activity_date: input.activityDate,
    note: input.note,
    client_ip_hash: meta.ipHash,
  });
  const files = await repo.createFiles(
    checked.map((f) => ({
      submission_id: submission.id,
      indicator_id: indicator.id,
      client_upload_id: f.clientUploadId,
      file_name: sanitizeFileName(f.name),
      mime_type: f.mime,
      media_type: f.mediaType,
      size_bytes: f.size,
    })),
  );
  return {
    submissionId: submission.id,
    chunkSize: CHUNK_SIZE,
    reused: false,
    files: files.map((f) => ({
      id: f.id,
      clientUploadId: f.client_upload_id,
      uploadToken: uploadTokenFor(f),
      status: f.status,
      bytesUploaded: 0,
    })),
  };
}

export function parseContentRange(h: string | null): { start: number; end: number; total: number } | null {
  const m = h?.match(/^bytes (\d+)-(\d+)\/(\d+)$/);
  if (!m) return null;
  const [start, end, total] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (!(start <= end && end < total)) return null;
  return { start, end, total };
}

export type ChunkResponse =
  | { status: "UPLOADING"; committed: number }
  | { status: "UPLOADED"; committed: number; driveFileId: string };

async function recomputeSubmission(submissionId: string) {
  const repo = getRepo();
  const files = await repo.listFiles({ submissionId });
  const live = files.filter((f) => f.status !== "DELETED");
  let status: SubmissionStatus = "UPLOADING";
  if (live.length && live.every((f) => f.status === "UPLOADED")) status = "COMPLETED";
  else if (live.length && live.every((f) => f.status === "FAILED")) status = "FAILED";
  else if (live.some((f) => f.status === "UPLOADED") && live.every((f) => ["UPLOADED", "FAILED", "MISSING"].includes(f.status)))
    status = "PARTIAL";
  await repo.updateSubmissionStatus(submissionId, status);
}

async function fail(file: EvidenceFile, message: string) {
  await getRepo().updateFile(file.id, { status: "FAILED", error_message: message.slice(0, 500) });
  await recomputeSubmission(file.submission_id);
}

/**
 * Receive one chunk (≤ CHUNK_SIZE) from the browser and forward it to the
 * Google Drive resumable session that only the server knows about.
 */
export async function handleChunk(
  fileId: string,
  token: string | null,
  contentRange: string | null,
  body: Uint8Array,
): Promise<ChunkResponse> {
  checkUploadToken(fileId, token);
  const repo = getRepo();
  let file = await repo.getFile(fileId);
  if (!file || file.status === "DELETED") throw new HttpError(404, "ไม่พบรายการไฟล์", "NOT_FOUND");
  if (file.status === "UPLOADED") return { status: "UPLOADED", committed: file.size_bytes, driveFileId: file.drive_file_id! };

  const range = parseContentRange(contentRange);
  if (!range) throw new HttpError(400, "Content-Range ไม่ถูกต้อง", "BAD_RANGE");
  if (range.total !== file.size_bytes) throw new HttpError(400, "ขนาดไฟล์ไม่ตรงกับที่แจ้งไว้", "SIZE_MISMATCH");
  if (body.byteLength !== range.end - range.start + 1) throw new HttpError(400, "ข้อมูลไม่ครบตามช่วงที่ระบุ", "BAD_RANGE");
  if (body.byteLength > CHUNK_SIZE) throw new HttpError(413, "ชิ้นข้อมูลใหญ่เกินกำหนด", "CHUNK_TOO_LARGE");
  const isLast = range.end === range.total - 1;
  if (!isLast && body.byteLength % (256 * 1024) !== 0) throw new HttpError(400, "ขนาดชิ้นข้อมูลไม่ถูกต้อง", "BAD_CHUNK");

  const sessionStale =
    file.drive_upload_session_at && Date.now() - new Date(file.drive_upload_session_at).getTime() > SESSION_MAX_AGE_MS;
  if (sessionStale) {
    file = (await repo.updateFile(file.id, {
      drive_upload_session_url: null,
      drive_upload_session_at: null,
      bytes_uploaded: 0,
    }))!;
  }

  if (range.start !== file.bytes_uploaded) {
    throw new HttpError(409, "ตำแหน่งข้อมูลไม่ตรงกัน ระบบจะอัปโหลดต่อจากจุดล่าสุด", "RANGE_MISMATCH", {
      committed: file.bytes_uploaded,
    });
  }

  if (range.start === 0) {
    // Verify real content type from magic bytes — never trust the extension alone.
    const sniffed = sniffMime(body.subarray(0, 64));
    if (!sniffMatches(file.mime_type, sniffed)) {
      await fail(file, "เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์ที่อนุญาต");
      throw new HttpError(415, `เนื้อหาไฟล์ "${file.file_name}" ไม่ใช่รูปภาพ/วิดีโอที่อนุญาต`, "BAD_CONTENT");
    }
  }

  const drive = await getDrive();
  try {
    if (!file.drive_upload_session_url) {
      if (range.start !== 0)
        throw new HttpError(409, "ต้องเริ่มอัปโหลดใหม่ตั้งแต่ต้น", "RANGE_MISMATCH", { committed: 0 });
      const folderId = await ensureIndicatorFolder(file.indicator_id);
      const url = await drive.initResumableUpload({
        name: file.file_name,
        mimeType: file.mime_type,
        parentId: folderId,
        size: file.size_bytes,
      });
      file = (await repo.updateFile(file.id, {
        drive_upload_session_url: url,
        drive_upload_session_at: new Date().toISOString(),
        drive_folder_id: folderId,
        status: "UPLOADING",
        error_message: null,
      }))!;
    } else if (file.status !== "UPLOADING") {
      file = (await repo.updateFile(file.id, { status: "UPLOADING", error_message: null }))!;
    }

    const result = await drive.uploadChunk(file.drive_upload_session_url!, body, range.start, range.total);
    if (!result.done) {
      await repo.updateFile(file.id, { bytes_uploaded: result.committed });
      return { status: "UPLOADING", committed: result.committed };
    }
    await repo.updateFile(file.id, {
      status: "UPLOADED",
      bytes_uploaded: file.size_bytes,
      drive_file_id: result.file.id,
      drive_md5: result.file.md5Checksum ?? null,
      drive_upload_session_url: null,
      drive_upload_session_at: null,
      uploaded_at: new Date().toISOString(),
      error_message: null,
    });
    await recomputeSubmission(file.submission_id);
    return { status: "UPLOADED", committed: file.size_bytes, driveFileId: result.file.id };
  } catch (e) {
    if (e instanceof DriveError && e.code === "SESSION_EXPIRED") {
      await repo.updateFile(file.id, { drive_upload_session_url: null, drive_upload_session_at: null, bytes_uploaded: 0 });
      throw new HttpError(409, e.message, "SESSION_EXPIRED", { committed: 0 });
    }
    if (e instanceof DriveError) {
      // Do NOT mark as uploaded. Keep progress so the client can retry/resume.
      await repo.updateFile(file.id, { status: "FAILED", error_message: e.message.slice(0, 500) });
      await recomputeSubmission(file.submission_id);
    }
    throw e;
  }
}

/** Ask Drive how many bytes it has committed, so the browser can resume after a network drop. */
export async function getUploadStatus(fileId: string, token: string | null) {
  checkUploadToken(fileId, token);
  const repo = getRepo();
  const file = await repo.getFile(fileId);
  if (!file || file.status === "DELETED") throw new HttpError(404, "ไม่พบรายการไฟล์", "NOT_FOUND");
  if (file.status === "UPLOADED") return { status: "UPLOADED" as const, committed: file.size_bytes };
  if (!file.drive_upload_session_url) {
    if (file.bytes_uploaded !== 0) await repo.updateFile(file.id, { bytes_uploaded: 0 });
    return { status: file.status, committed: 0 };
  }
  const drive = await getDrive();
  try {
    const r = await drive.queryUploadStatus(file.drive_upload_session_url, file.size_bytes);
    if (r.done) {
      await repo.updateFile(file.id, {
        status: "UPLOADED",
        bytes_uploaded: file.size_bytes,
        drive_file_id: r.file.id,
        drive_md5: r.file.md5Checksum ?? null,
        drive_upload_session_url: null,
        drive_upload_session_at: null,
        uploaded_at: new Date().toISOString(),
        error_message: null,
      });
      await recomputeSubmission(file.submission_id);
      return { status: "UPLOADED" as const, committed: file.size_bytes };
    }
    await repo.updateFile(file.id, { bytes_uploaded: r.committed });
    return { status: file.status, committed: r.committed };
  } catch (e) {
    if (e instanceof DriveError && e.code === "SESSION_EXPIRED") {
      await repo.updateFile(file.id, { drive_upload_session_url: null, drive_upload_session_at: null, bytes_uploaded: 0 });
      return { status: file.status, committed: 0 };
    }
    throw e;
  }
}

export { recomputeSubmission };
