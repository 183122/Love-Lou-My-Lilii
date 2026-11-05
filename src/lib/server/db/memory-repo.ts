import { randomUUID } from "node:crypto";
import { SEED_CATEGORIES, SEED_INDICATORS } from "@/data/indicators";
import type { Category, DriveFolder, EvidenceFile, Indicator, Submission } from "@/lib/shared/types";
import { RepoError, type FileFilter, type Repo, type SessionRow, type SettingRow } from "./types";

/**
 * In-memory implementation for AUTOMATED TESTS ONLY.
 * It is never selected in production (see backends.ts) and the UI shows a
 * "TEST MODE" banner whenever it is active.
 */
export class MemoryRepo implements Repo {
  readonly kind = "memory" as const;
  categories: Category[] = [];
  indicators: Indicator[] = [];
  submissions: Submission[] = [];
  files: EvidenceFile[] = [];
  folders: DriveFolder[] = [];
  settings = new Map<string, SettingRow>();
  sessions: SessionRow[] = [];
  limits = new Map<string, { hits: number; start: number }>();

  static seeded(): MemoryRepo {
    const r = new MemoryRepo();
    for (const c of SEED_CATEGORIES) {
      r.categories.push({
        id: randomUUID(),
        code: c.code,
        name: c.name,
        name_en: c.nameEn,
        color: c.color,
        sort_order: c.sortOrder,
        is_active: true,
      });
    }
    for (const i of SEED_INDICATORS) {
      r.indicators.push({
        id: randomUUID(),
        code: i.code,
        category_id: r.categories.find((c) => c.code === i.categoryCode)!.id,
        title: i.title,
        description: i.description,
        recommended_evidence: i.recommendedEvidence,
        required_image_count: i.requiredImageCount,
        required_video_count: i.requiredVideoCount,
        sort_order: i.sortOrder,
        is_active: true,
      });
    }
    return r;
  }

  private sort<T extends { sort_order: number; code: string }>(xs: T[]) {
    return [...xs].sort((a, b) => a.sort_order - b.sort_order || a.code.localeCompare(b.code));
  }

  async listCategories() {
    return this.sort(this.categories).map((c) => ({ ...c }));
  }
  async createCategory(c: Omit<Category, "id">) {
    if (this.categories.some((x) => x.code === c.code)) throw new RepoError("duplicate", "CONFLICT");
    const row = { ...c, id: randomUUID() };
    this.categories.push(row);
    return { ...row };
  }
  async updateCategory(id: string, patch: Partial<Omit<Category, "id">>) {
    const c = this.categories.find((x) => x.id === id);
    if (!c) return null;
    if (patch.code && this.categories.some((x) => x.code === patch.code && x.id !== id))
      throw new RepoError("duplicate", "CONFLICT");
    Object.assign(c, patch);
    return { ...c };
  }
  async deleteCategory(id: string) {
    if (this.indicators.some((i) => i.category_id === id)) throw new RepoError("referenced", "CONFLICT");
    this.categories = this.categories.filter((c) => c.id !== id);
  }

  async listIndicators() {
    return this.sort(this.indicators).map((i) => ({ ...i }));
  }
  async getIndicator(id: string) {
    const i = this.indicators.find((x) => x.id === id);
    return i ? { ...i } : null;
  }
  async createIndicator(i: Omit<Indicator, "id">) {
    if (this.indicators.some((x) => x.code === i.code)) throw new RepoError("duplicate", "CONFLICT");
    const row = { ...i, id: randomUUID() };
    this.indicators.push(row);
    return { ...row };
  }
  async updateIndicator(id: string, patch: Partial<Omit<Indicator, "id">>) {
    const i = this.indicators.find((x) => x.id === id);
    if (!i) return null;
    if (patch.code && this.indicators.some((x) => x.code === patch.code && x.id !== id))
      throw new RepoError("duplicate", "CONFLICT");
    Object.assign(i, patch);
    return { ...i };
  }
  async countFilesForIndicator(id: string) {
    return this.files.filter((f) => f.indicator_id === id).length;
  }
  async deleteIndicator(id: string) {
    if (this.files.some((f) => f.indicator_id === id)) throw new RepoError("referenced", "CONFLICT");
    this.indicators = this.indicators.filter((i) => i.id !== id);
  }
  async getIndicatorCounts() {
    return this.indicators.map((i) => {
      const fs = this.files.filter((f) => f.indicator_id === i.id && f.status === "UPLOADED");
      const last = fs.map((f) => f.uploaded_at!).sort().at(-1) ?? null;
      return {
        indicator_id: i.id,
        image_count: fs.filter((f) => f.media_type === "IMAGE").length,
        video_count: fs.filter((f) => f.media_type === "VIDEO").length,
        vtr_selected_count: fs.filter((f) => f.is_vtr_selected).length,
        last_uploaded_at: last,
      };
    });
  }

  async createSubmission(s: Parameters<Repo["createSubmission"]>[0]) {
    const row: Submission = { status: "UPLOADING", ...s, id: randomUUID(), created_at: new Date().toISOString() };
    this.submissions.push(row);
    return { ...row };
  }
  async getSubmission(id: string) {
    const s = this.submissions.find((x) => x.id === id);
    return s ? { ...s } : null;
  }
  async listSubmissions(ids: string[]) {
    return this.submissions.filter((s) => ids.includes(s.id)).map((s) => ({ ...s }));
  }
  async updateSubmissionStatus(id: string, status: Submission["status"]) {
    const s = this.submissions.find((x) => x.id === id);
    if (s) s.status = status;
  }

  async createFiles(rows: Parameters<Repo["createFiles"]>[0]) {
    if (rows.some((r) => this.files.some((f) => f.client_upload_id === r.client_upload_id)))
      throw new RepoError("duplicate", "CONFLICT");
    const now = new Date().toISOString();
    const created = rows.map(
      (r): EvidenceFile => ({
        ...r,
        id: randomUUID(),
        status: "PENDING",
        bytes_uploaded: 0,
        drive_upload_session_url: null,
        drive_upload_session_at: null,
        drive_file_id: null,
        drive_folder_id: null,
        drive_md5: null,
        error_message: null,
        is_vtr_selected: false,
        vtr_order: null,
        vtr_note: "",
        uploaded_at: null,
        deleted_at: null,
        created_at: now,
      }),
    );
    this.files.push(...created);
    return created.map((f) => ({ ...f }));
  }
  async getFile(id: string) {
    const f = this.files.find((x) => x.id === id);
    return f ? { ...f } : null;
  }
  async getFilesByClientUploadIds(ids: string[]) {
    return this.files.filter((f) => ids.includes(f.client_upload_id)).map((f) => ({ ...f }));
  }
  async updateFile(id: string, patch: Parameters<Repo["updateFile"]>[1]) {
    const f = this.files.find((x) => x.id === id);
    if (!f) return null;
    if (patch.drive_file_id && this.files.some((x) => x.drive_file_id === patch.drive_file_id && x.id !== id))
      throw new RepoError("duplicate drive_file_id", "CONFLICT");
    Object.assign(f, patch);
    return { ...f };
  }
  async listFiles(filter: FileFilter) {
    return this.files
      .filter(
        (f) =>
          (!filter.indicatorId || f.indicator_id === filter.indicatorId) &&
          (!filter.submissionId || f.submission_id === filter.submissionId) &&
          (!filter.statuses?.length || filter.statuses.includes(f.status)) &&
          (!filter.mediaType || f.media_type === filter.mediaType) &&
          (!filter.vtrOnly || f.is_vtr_selected) &&
          (!filter.ids || filter.ids.includes(f.id)),
      )
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((f) => ({ ...f }));
  }
  async deleteFileRow(id: string) {
    this.files = this.files.filter((f) => f.id !== id);
  }

  async listDriveFolders(rootFolderId: string) {
    return this.folders.filter((f) => f.root_folder_id === rootFolderId).map((f) => ({ ...f }));
  }
  async insertDriveFolder(f: Omit<DriveFolder, "id">) {
    const dup = this.folders.some(
      (x) =>
        x.drive_folder_id === f.drive_folder_id ||
        (x.root_folder_id === f.root_folder_id &&
          x.kind === f.kind &&
          ((f.kind === "CATEGORY" && x.category_id === f.category_id) ||
            (f.kind === "INDICATOR" && x.indicator_id === f.indicator_id))),
    );
    if (dup) throw new RepoError("duplicate folder", "CONFLICT");
    const row = { ...f, id: randomUUID() };
    this.folders.push(row);
    return { ...row };
  }
  async deleteDriveFoldersForRoot(rootFolderId: string) {
    this.folders = this.folders.filter((f) => f.root_folder_id !== rootFolderId);
  }

  async getSettings() {
    return [...this.settings.values()].map((s) => ({ ...s }));
  }
  async setSetting(key: string, value: unknown, isSecret = false) {
    this.settings.set(key, { key, value, is_secret: isSecret });
  }
  async deleteSetting(key: string) {
    this.settings.delete(key);
  }

  async createSession(s: Parameters<Repo["createSession"]>[0]) {
    this.sessions.push({
      id: randomUUID(),
      token_hash: s.token_hash,
      role: s.role,
      csrf_token: s.csrf_token,
      expires_at: s.expires_at,
      last_seen_at: new Date().toISOString(),
    });
  }
  async getSessionByTokenHash(hash: string) {
    const s = this.sessions.find((x) => x.token_hash === hash);
    return s ? { ...s } : null;
  }
  async touchSession(id: string) {
    const s = this.sessions.find((x) => x.id === id);
    if (s) s.last_seen_at = new Date().toISOString();
  }
  async deleteSessionByTokenHash(hash: string) {
    this.sessions = this.sessions.filter((s) => s.token_hash !== hash);
  }
  async deleteSessionsByRole(role: SessionRow["role"]) {
    this.sessions = this.sessions.filter((s) => s.role !== role);
  }
  async purgeExpiredSessions() {
    const now = new Date().toISOString();
    this.sessions = this.sessions.filter((s) => s.expires_at > now);
  }

  async rateLimitHit(bucket: string, limit: number, windowSeconds: number) {
    const now = Date.now();
    const cur = this.limits.get(bucket);
    if (!cur || cur.start < now - windowSeconds * 1000) {
      this.limits.set(bucket, { hits: 1, start: now });
      return 1 <= limit;
    }
    cur.hits++;
    return cur.hits <= limit;
  }
}
