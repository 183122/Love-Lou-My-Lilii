import "server-only";
import type { EvidenceFile, EvidenceItem, MediaType } from "@/lib/shared/types";
export type { EvidenceItem };
import { getRepo } from "./backends";
import { DriveError } from "./drive/types";
import { getDrive } from "./drive/service";
import { HttpError } from "./http";
import { recomputeSubmission } from "./uploads";


export async function listEvidence(opts: {
  indicatorId?: string;
  mediaType?: MediaType;
  vtrOnly?: boolean;
  includeAllStatuses?: boolean;
}): Promise<EvidenceItem[]> {
  const repo = getRepo();
  const files = await repo.listFiles({
    indicatorId: opts.indicatorId,
    mediaType: opts.mediaType,
    vtrOnly: opts.vtrOnly,
    statuses: opts.includeAllStatuses ? undefined : ["UPLOADED"],
  });
  const [indicators, categories, submissions] = await Promise.all([
    repo.listIndicators(),
    repo.listCategories(),
    repo.listSubmissions([...new Set(files.map((f) => f.submission_id))]),
  ]);
  const ind = new Map(indicators.map((i) => [i.id, i]));
  const cat = new Map(categories.map((c) => [c.id, c]));
  const sub = new Map(submissions.map((s) => [s.id, s]));
  return files
    .filter((f) => f.status !== "DELETED")
    .map((f) => {
      const i = ind.get(f.indicator_id)!;
      const c = cat.get(i.category_id)!;
      const s = sub.get(f.submission_id)!;
      return {
        id: f.id,
        file_name: f.file_name,
        mime_type: f.mime_type,
        media_type: f.media_type,
        size_bytes: f.size_bytes,
        status: f.status,
        uploaded_at: f.uploaded_at,
        created_at: f.created_at,
        is_vtr_selected: f.is_vtr_selected,
        vtr_order: f.vtr_order,
        vtr_note: f.vtr_note,
        has_drive_file: Boolean(f.drive_file_id),
        indicator: { id: i.id, code: i.code, title: i.title },
        category: { id: c.id, code: c.code, name: c.name },
        submission: {
          id: s.id,
          activity_title: s.activity_title,
          activity_detail: s.activity_detail,
          activity_date: s.activity_date,
          submitter_name: s.submitter_name,
          submitter_position: s.submitter_position,
          note: s.note,
          created_at: s.created_at,
        },
      };
    });
}

/** Mark a file MISSING when Drive says it no longer exists (dashboard status recalculates automatically). */
export async function markMissing(file: EvidenceFile) {
  await getRepo().updateFile(file.id, { status: "MISSING", error_message: "ไฟล์ถูกลบหรือเพิกถอนสิทธิ์ใน Google Drive" });
  await recomputeSubmission(file.submission_id);
}

export async function getReadableFile(id: string): Promise<EvidenceFile> {
  const file = await getRepo().getFile(id);
  if (!file || !file.drive_file_id || file.status === "DELETED")
    throw new HttpError(404, "ไม่พบไฟล์", "NOT_FOUND");
  if (file.status === "MISSING") throw new HttpError(410, "ไฟล์นี้ถูกลบออกจาก Google Drive แล้ว", "MISSING");
  return file;
}

/** Stream file content from Drive through the server (supports Range for video seeking). */
export async function streamFile(file: EvidenceFile, range: string | null, download: boolean): Promise<Response> {
  const drive = await getDrive();
  let upstream: Response;
  try {
    upstream = await drive.download(file.drive_file_id!, range);
  } catch (e) {
    if (e instanceof DriveError && e.code === "NOT_FOUND") {
      await markMissing(file);
      throw new HttpError(410, "ไฟล์นี้ถูกลบออกจาก Google Drive แล้ว ระบบได้ปรับสถานะตัวชี้วัดใหม่", "MISSING");
    }
    throw e;
  }
  const headers = new Headers();
  headers.set("Content-Type", file.mime_type);
  for (const h of ["content-length", "content-range"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "private, max-age=300");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Content-Security-Policy", "default-src 'none'; media-src 'self'; img-src 'self'; sandbox");
  const encoded = encodeURIComponent(file.file_name);
  headers.set("Content-Disposition", `${download ? "attachment" : "inline"}; filename*=UTF-8''${encoded}`);
  return new Response(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
}

/** Check every uploaded file still exists in Drive; mark missing ones. */
export async function verifyAllFiles(): Promise<{ checked: number; missing: number }> {
  const repo = getRepo();
  const drive = await getDrive();
  const files = await repo.listFiles({ statuses: ["UPLOADED", "MISSING"] });
  let missing = 0;
  for (const f of files) {
    if (!f.drive_file_id) continue;
    const meta = await drive.getFile(f.drive_file_id);
    const gone = !meta || meta.trashed;
    if (gone && f.status === "UPLOADED") {
      await markMissing(f);
      missing++;
    } else if (!gone && f.status === "MISSING") {
      await repo.updateFile(f.id, { status: "UPLOADED", error_message: null });
      await recomputeSubmission(f.submission_id);
    } else if (gone) missing++;
  }
  return { checked: files.length, missing };
}

/**
 * Admin delete. mode "database": remove the DB record only (the Drive file stays).
 * mode "drive": move the Drive file to trash (recoverable for 30 days) AND remove the record.
 */
export async function deleteEvidence(id: string, mode: "database" | "drive") {
  const repo = getRepo();
  const file = await repo.getFile(id);
  if (!file) throw new HttpError(404, "ไม่พบไฟล์", "NOT_FOUND");
  if (mode === "drive" && file.drive_file_id) {
    const drive = await getDrive();
    await drive.trash(file.drive_file_id);
  }
  await repo.deleteFileRow(file.id);
  await recomputeSubmission(file.submission_id);
  return { deleted: true, driveTrashed: mode === "drive" && Boolean(file.drive_file_id) };
}
