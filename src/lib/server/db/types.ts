import type {
  Category,
  DriveFolder,
  EvidenceFile,
  FileStatus,
  Indicator,
  IndicatorCounts,
  MediaType,
  SessionRole,
  Submission,
  SubmissionStatus,
} from "@/lib/shared/types";

export interface SessionRow {
  id: string;
  token_hash: string;
  role: SessionRole;
  csrf_token: string;
  expires_at: string;
  last_seen_at: string;
}

export interface SettingRow {
  key: string;
  value: unknown;
  is_secret: boolean;
}

export interface FileFilter {
  indicatorId?: string;
  submissionId?: string;
  statuses?: FileStatus[];
  mediaType?: MediaType;
  vtrOnly?: boolean;
  ids?: string[];
}

export type NewCategory = Omit<Category, "id">;
export type NewIndicator = Omit<Indicator, "id">;
export type NewSubmission = Omit<Submission, "id" | "created_at" | "status"> & { status?: SubmissionStatus };
export type NewEvidenceFile = Pick<
  EvidenceFile,
  "submission_id" | "indicator_id" | "client_upload_id" | "file_name" | "mime_type" | "media_type" | "size_bytes"
>;
export type FilePatch = Partial<Omit<EvidenceFile, "id" | "submission_id" | "client_upload_id" | "created_at">>;

/**
 * Data-access contract. Production uses SupabaseRepo (service-role, server-only).
 * MemoryRepo exists ONLY for automated tests and is refused in production.
 */
export interface Repo {
  readonly kind: "supabase" | "memory";

  listCategories(): Promise<Category[]>;
  createCategory(c: NewCategory): Promise<Category>;
  updateCategory(id: string, patch: Partial<NewCategory>): Promise<Category | null>;
  deleteCategory(id: string): Promise<void>;

  listIndicators(): Promise<Indicator[]>;
  getIndicator(id: string): Promise<Indicator | null>;
  createIndicator(i: NewIndicator): Promise<Indicator>;
  updateIndicator(id: string, patch: Partial<NewIndicator>): Promise<Indicator | null>;
  countFilesForIndicator(id: string): Promise<number>;
  deleteIndicator(id: string): Promise<void>;
  getIndicatorCounts(): Promise<IndicatorCounts[]>;

  createSubmission(s: NewSubmission): Promise<Submission>;
  getSubmission(id: string): Promise<Submission | null>;
  listSubmissions(ids: string[]): Promise<Submission[]>;
  updateSubmissionStatus(id: string, status: SubmissionStatus): Promise<void>;

  createFiles(rows: NewEvidenceFile[]): Promise<EvidenceFile[]>;
  getFile(id: string): Promise<EvidenceFile | null>;
  getFilesByClientUploadIds(ids: string[]): Promise<EvidenceFile[]>;
  updateFile(id: string, patch: FilePatch): Promise<EvidenceFile | null>;
  listFiles(filter: FileFilter): Promise<EvidenceFile[]>;
  deleteFileRow(id: string): Promise<void>;

  listDriveFolders(rootFolderId: string): Promise<DriveFolder[]>;
  insertDriveFolder(f: Omit<DriveFolder, "id">): Promise<DriveFolder>;
  deleteDriveFoldersForRoot(rootFolderId: string): Promise<void>;

  getSettings(): Promise<SettingRow[]>;
  setSetting(key: string, value: unknown, isSecret?: boolean): Promise<void>;
  deleteSetting(key: string): Promise<void>;

  createSession(s: Omit<SessionRow, "id" | "last_seen_at"> & { ip_hash?: string; user_agent?: string }): Promise<void>;
  getSessionByTokenHash(hash: string): Promise<SessionRow | null>;
  touchSession(id: string): Promise<void>;
  deleteSessionByTokenHash(hash: string): Promise<void>;
  deleteSessionsByRole(role: SessionRole): Promise<void>;
  purgeExpiredSessions(): Promise<void>;

  /** Returns true when the request is allowed. */
  rateLimitHit(bucket: string, limit: number, windowSeconds: number): Promise<boolean>;
}

export class RepoError extends Error {
  constructor(
    message: string,
    public code: "CONFLICT" | "NOT_FOUND" | "DB",
  ) {
    super(message);
  }
}
