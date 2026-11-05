import "server-only";
import { createClient, type PostgrestError, type SupabaseClient } from "@supabase/supabase-js";
import type { Category, DriveFolder, EvidenceFile, Indicator, IndicatorCounts, Submission } from "@/lib/shared/types";
import { RepoError, type FileFilter, type Repo, type SessionRow, type SettingRow } from "./types";

const FILE_COLUMNS =
  "id,submission_id,indicator_id,client_upload_id,file_name,mime_type,media_type,size_bytes,status,bytes_uploaded,drive_upload_session_url,drive_upload_session_at,drive_file_id,drive_folder_id,drive_md5,error_message,is_vtr_selected,vtr_order,vtr_note,uploaded_at,deleted_at,created_at";

function fail(error: PostgrestError | null, what: string): never {
  if (error?.code === "23505") throw new RepoError(`${what}: ข้อมูลซ้ำ`, "CONFLICT");
  if (error?.code === "23503") throw new RepoError(`${what}: มีข้อมูลอื่นอ้างอิงอยู่`, "CONFLICT");
  console.error(`[db] ${what}`, error);
  throw new RepoError(`${what}: ${error?.message ?? "unknown database error"}`, "DB");
}

function normFile(r: Record<string, unknown>): EvidenceFile {
  return { ...(r as unknown as EvidenceFile), size_bytes: Number(r.size_bytes), bytes_uploaded: Number(r.bytes_uploaded) };
}

export class SupabaseRepo implements Repo {
  readonly kind = "supabase" as const;
  private db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store" }) },
    });
  }

  async listCategories() {
    const { data, error } = await this.db.from("categories").select("*").order("sort_order").order("code");
    if (error) fail(error, "listCategories");
    return data as Category[];
  }
  async createCategory(c: Omit<Category, "id">) {
    const { data, error } = await this.db.from("categories").insert(c).select().single();
    if (error) fail(error, "createCategory");
    return data as Category;
  }
  async updateCategory(id: string, patch: Partial<Omit<Category, "id">>) {
    const { data, error } = await this.db.from("categories").update(patch).eq("id", id).select().maybeSingle();
    if (error) fail(error, "updateCategory");
    return (data as Category) ?? null;
  }
  async deleteCategory(id: string) {
    const { error } = await this.db.from("categories").delete().eq("id", id);
    if (error) fail(error, "deleteCategory");
  }

  async listIndicators() {
    const { data, error } = await this.db.from("indicators").select("*").order("sort_order").order("code");
    if (error) fail(error, "listIndicators");
    return data as Indicator[];
  }
  async getIndicator(id: string) {
    const { data, error } = await this.db.from("indicators").select("*").eq("id", id).maybeSingle();
    if (error) fail(error, "getIndicator");
    return (data as Indicator) ?? null;
  }
  async createIndicator(i: Omit<Indicator, "id">) {
    const { data, error } = await this.db.from("indicators").insert(i).select().single();
    if (error) fail(error, "createIndicator");
    return data as Indicator;
  }
  async updateIndicator(id: string, patch: Partial<Omit<Indicator, "id">>) {
    const { data, error } = await this.db.from("indicators").update(patch).eq("id", id).select().maybeSingle();
    if (error) fail(error, "updateIndicator");
    return (data as Indicator) ?? null;
  }
  async countFilesForIndicator(id: string) {
    const { count, error } = await this.db
      .from("evidence_files")
      .select("id", { count: "exact", head: true })
      .eq("indicator_id", id);
    if (error) fail(error, "countFilesForIndicator");
    return count ?? 0;
  }
  async deleteIndicator(id: string) {
    const { error } = await this.db.from("indicators").delete().eq("id", id);
    if (error) fail(error, "deleteIndicator");
  }
  async getIndicatorCounts() {
    const { data, error } = await this.db.from("indicator_file_counts").select("*");
    if (error) fail(error, "getIndicatorCounts");
    return (data as Record<string, unknown>[]).map((r) => ({
      indicator_id: String(r.indicator_id),
      image_count: Number(r.image_count),
      video_count: Number(r.video_count),
      vtr_selected_count: Number(r.vtr_selected_count),
      last_uploaded_at: (r.last_uploaded_at as string) ?? null,
    })) as IndicatorCounts[];
  }

  async createSubmission(s: Parameters<Repo["createSubmission"]>[0]) {
    const { data, error } = await this.db.from("submissions").insert(s).select().single();
    if (error) fail(error, "createSubmission");
    return data as Submission;
  }
  async getSubmission(id: string) {
    const { data, error } = await this.db.from("submissions").select("*").eq("id", id).maybeSingle();
    if (error) fail(error, "getSubmission");
    return (data as Submission) ?? null;
  }
  async listSubmissions(ids: string[]) {
    if (ids.length === 0) return [];
    const out: Submission[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await this.db.from("submissions").select("*").in("id", ids.slice(i, i + 200));
      if (error) fail(error, "listSubmissions");
      out.push(...(data as Submission[]));
    }
    return out;
  }
  async updateSubmissionStatus(id: string, status: Submission["status"]) {
    const { error } = await this.db.from("submissions").update({ status }).eq("id", id);
    if (error) fail(error, "updateSubmissionStatus");
  }

  async createFiles(rows: Parameters<Repo["createFiles"]>[0]) {
    const { data, error } = await this.db.from("evidence_files").insert(rows).select(FILE_COLUMNS);
    if (error) fail(error, "createFiles");
    return (data as unknown as Record<string, unknown>[]).map(normFile);
  }
  async getFile(id: string) {
    const { data, error } = await this.db.from("evidence_files").select(FILE_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error, "getFile");
    return data ? normFile(data as unknown as Record<string, unknown>) : null;
  }
  async getFilesByClientUploadIds(ids: string[]) {
    if (ids.length === 0) return [];
    const { data, error } = await this.db.from("evidence_files").select(FILE_COLUMNS).in("client_upload_id", ids);
    if (error) fail(error, "getFilesByClientUploadIds");
    return (data as unknown as Record<string, unknown>[]).map(normFile);
  }
  async updateFile(id: string, patch: Parameters<Repo["updateFile"]>[1]) {
    const { data, error } = await this.db.from("evidence_files").update(patch).eq("id", id).select(FILE_COLUMNS).maybeSingle();
    if (error) fail(error, "updateFile");
    return data ? normFile(data as unknown as Record<string, unknown>) : null;
  }
  async listFiles(filter: FileFilter) {
    const out: EvidenceFile[] = [];
    const page = 1000;
    for (let from = 0; ; from += page) {
      let q = this.db.from("evidence_files").select(FILE_COLUMNS);
      if (filter.indicatorId) q = q.eq("indicator_id", filter.indicatorId);
      if (filter.submissionId) q = q.eq("submission_id", filter.submissionId);
      if (filter.statuses?.length) q = q.in("status", filter.statuses);
      if (filter.mediaType) q = q.eq("media_type", filter.mediaType);
      if (filter.vtrOnly) q = q.eq("is_vtr_selected", true);
      if (filter.ids) q = q.in("id", filter.ids.length ? filter.ids : ["00000000-0000-0000-0000-000000000000"]);
      const { data, error } = await q.order("created_at", { ascending: false }).range(from, from + page - 1);
      if (error) fail(error, "listFiles");
      const rows = (data as unknown as Record<string, unknown>[]).map(normFile);
      out.push(...rows);
      if (rows.length < page) break;
    }
    return out;
  }
  async deleteFileRow(id: string) {
    const { error } = await this.db.from("evidence_files").delete().eq("id", id);
    if (error) fail(error, "deleteFileRow");
  }

  async listDriveFolders(rootFolderId: string) {
    const { data, error } = await this.db.from("drive_folders").select("*").eq("root_folder_id", rootFolderId);
    if (error) fail(error, "listDriveFolders");
    return data as DriveFolder[];
  }
  async insertDriveFolder(f: Omit<DriveFolder, "id">) {
    const { data, error } = await this.db.from("drive_folders").insert(f).select().single();
    if (error) fail(error, "insertDriveFolder");
    return data as DriveFolder;
  }
  async deleteDriveFoldersForRoot(rootFolderId: string) {
    const { error } = await this.db.from("drive_folders").delete().eq("root_folder_id", rootFolderId);
    if (error) fail(error, "deleteDriveFoldersForRoot");
  }

  async getSettings() {
    const { data, error } = await this.db.from("system_settings").select("key,value,is_secret");
    if (error) fail(error, "getSettings");
    return data as SettingRow[];
  }
  async setSetting(key: string, value: unknown, isSecret = false) {
    const { error } = await this.db
      .from("system_settings")
      .upsert({ key, value, is_secret: isSecret }, { onConflict: "key" });
    if (error) fail(error, "setSetting");
  }
  async deleteSetting(key: string) {
    const { error } = await this.db.from("system_settings").delete().eq("key", key);
    if (error) fail(error, "deleteSetting");
  }

  async createSession(s: Parameters<Repo["createSession"]>[0]) {
    const { error } = await this.db.from("admin_sessions").insert(s);
    if (error) fail(error, "createSession");
  }
  async getSessionByTokenHash(hash: string) {
    const { data, error } = await this.db
      .from("admin_sessions")
      .select("id,token_hash,role,csrf_token,expires_at,last_seen_at")
      .eq("token_hash", hash)
      .maybeSingle();
    if (error) fail(error, "getSessionByTokenHash");
    return (data as SessionRow) ?? null;
  }
  async touchSession(id: string) {
    const { error } = await this.db.from("admin_sessions").update({ last_seen_at: new Date().toISOString() }).eq("id", id);
    if (error) fail(error, "touchSession");
  }
  async deleteSessionByTokenHash(hash: string) {
    const { error } = await this.db.from("admin_sessions").delete().eq("token_hash", hash);
    if (error) fail(error, "deleteSessionByTokenHash");
  }
  async deleteSessionsByRole(role: SessionRow["role"]) {
    const { error } = await this.db.from("admin_sessions").delete().eq("role", role);
    if (error) fail(error, "deleteSessionsByRole");
  }
  async purgeExpiredSessions() {
    const { error } = await this.db.from("admin_sessions").delete().lt("expires_at", new Date().toISOString());
    if (error) fail(error, "purgeExpiredSessions");
  }

  async rateLimitHit(bucket: string, limit: number, windowSeconds: number) {
    const { data, error } = await this.db.rpc("rate_limit_hit", {
      p_bucket: bucket,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) fail(error, "rateLimitHit");
    return data === true;
  }
}
