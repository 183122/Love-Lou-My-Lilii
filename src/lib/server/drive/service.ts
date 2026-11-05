import "server-only";
import type { Category, DriveFolder, Indicator } from "@/lib/shared/types";
import { getFakeDrive, getRepo, isTestMode } from "../backends";
import { decryptSecret, encryptSecret } from "../crypto";
import { env } from "../env";
import { RepoError } from "../db/types";
import { loadSettings, SECRET_KEYS, SETTING_KEYS } from "../settings";
import { GoogleDriveClient } from "./google-drive";
import { DriveError, type DriveClient } from "./types";

export interface StoredOAuth {
  refresh_token_enc: string;
  email: string;
  scope: string;
  connected_at: string;
}

function encKey() {
  return env.tokenEncryptionKey || env.sessionSecret;
}

export async function storeRefreshToken(refreshToken: string, email: string, scope: string) {
  const value: StoredOAuth = {
    refresh_token_enc: encryptSecret(refreshToken, encKey()),
    email,
    scope,
    connected_at: new Date().toISOString(),
  };
  await getRepo().setSetting(SECRET_KEYS.googleOAuth, value, true);
  driveCache = null;
}

export async function clearStoredToken() {
  await getRepo().deleteSetting(SECRET_KEYS.googleOAuth);
  driveCache = null;
}

async function loadRefreshToken(): Promise<{ token: string; source: "database" | "env"; email?: string; scope?: string } | null> {
  const rows = await getRepo().getSettings();
  const row = rows.find((r) => r.key === SECRET_KEYS.googleOAuth)?.value as StoredOAuth | undefined;
  if (row?.refresh_token_enc) {
    try {
      return { token: decryptSecret(row.refresh_token_enc, encKey()), source: "database", email: row.email, scope: row.scope };
    } catch {
      throw new DriveError("TOKEN_REVOKED", "cannot decrypt stored token (SESSION_SECRET/TOKEN_ENCRYPTION_KEY changed?)");
    }
  }
  if (env.googleRefreshToken) return { token: env.googleRefreshToken, source: "env" };
  return null;
}

let driveCache: { key: string; client: DriveClient } | null = null;

/** Returns a ready Drive client or throws a DriveError with a helpful Thai message. */
export async function getDrive(): Promise<DriveClient> {
  if (isTestMode()) return getFakeDrive();
  if (!env.googleClientId || !env.googleClientSecret) throw new DriveError("NOT_CONFIGURED");
  const rt = await loadRefreshToken();
  if (!rt) throw new DriveError("NOT_CONNECTED");
  const key = rt.token.slice(-16);
  if (driveCache?.key === key) return driveCache.client;
  const client = new GoogleDriveClient({
    clientId: env.googleClientId,
    clientSecret: env.googleClientSecret,
    refreshToken: rt.token,
  });
  driveCache = { key, client };
  return client;
}

export interface DriveStatus {
  configured: boolean;
  connected: boolean;
  tokenSource: "database" | "env" | null;
  account: string | null;
  scope: string | null;
  rootFolderId: string | null;
  rootFolderName: string | null;
  rootAccessible: boolean;
  rootWritable: boolean;
  foldersMapped: number;
  foldersExpected: number;
  error: { code: string; message: string } | null;
  testMode: boolean;
}

/** Performs real API calls to report the actual connection state. */
export async function getDriveStatus(): Promise<DriveStatus> {
  const settings = await loadSettings();
  const repo = getRepo();
  const [indicators, categories] = await Promise.all([repo.listIndicators(), repo.listCategories()]);
  const expected = 1 + categories.filter((c) => c.is_active).length + indicators.filter((i) => i.is_active).length;
  const status: DriveStatus = {
    configured: isTestMode() || Boolean(env.googleClientId && env.googleClientSecret),
    connected: false,
    tokenSource: null,
    account: null,
    scope: null,
    rootFolderId: settings.driveRootFolderId || null,
    rootFolderName: null,
    rootAccessible: false,
    rootWritable: false,
    foldersMapped: 0,
    foldersExpected: expected,
    error: null,
    testMode: isTestMode(),
  };
  try {
    if (!isTestMode()) {
      const rt = await loadRefreshToken();
      status.tokenSource = rt?.source ?? null;
      status.scope = rt?.scope ?? null;
    } else {
      status.tokenSource = "env";
    }
    const drive = await getDrive();
    const me = await drive.about();
    status.connected = true;
    status.account = me.email;
    if (settings.driveRootFolderId) {
      const meta = await drive.getFile(settings.driveRootFolderId);
      if (!meta || meta.trashed) {
        status.error = {
          code: "ROOT_NOT_FOUND",
          message:
            "ไม่พบโฟลเดอร์หลักใน Google Drive (ถูกลบ ย้ายไปถังขยะ หรือบัญชีนี้ไม่มีสิทธิ์) — กด “สร้าง/ซ่อมโครงสร้างโฟลเดอร์” หรือแก้ Root Folder ID",
        };
      } else {
        status.rootAccessible = true;
        status.rootFolderName = meta.name;
        status.rootWritable = meta.capabilities?.canAddChildren !== false;
        if (!status.rootWritable)
          status.error = { code: "FORBIDDEN", message: new DriveError("FORBIDDEN").message };
        status.foldersMapped = (await repo.listDriveFolders(settings.driveRootFolderId)).length;
      }
    }
  } catch (e) {
    if (e instanceof DriveError) status.error = { code: e.code, message: e.message };
    else status.error = { code: "UNKNOWN", message: e instanceof Error ? e.message : String(e) };
  }
  return status;
}

// ---------------------------------------------------------------------------
// Folder structure: ROOT / "A. การบริหารงานทั่วไป" / "A01 ประชุมครู..."
// ---------------------------------------------------------------------------
export function categoryFolderName(c: Pick<Category, "code" | "name">) {
  return `${c.code}. ${c.name}`.slice(0, 200);
}
export function indicatorFolderName(i: Pick<Indicator, "code" | "title">) {
  return `${i.code} ${i.title}`.replace(/[\\/]/g, "-").slice(0, 200);
}

async function insertFolder(f: Omit<DriveFolder, "id">, existing: DriveFolder[]): Promise<DriveFolder> {
  try {
    const row = await getRepo().insertDriveFolder(f);
    existing.push(row);
    return row;
  } catch (e) {
    // Another request created the mapping concurrently — reuse it.
    if (e instanceof RepoError && e.code === "CONFLICT") {
      const fresh = await getRepo().listDriveFolders(f.root_folder_id);
      const hit = fresh.find(
        (x) =>
          x.kind === f.kind &&
          (f.kind === "CATEGORY" ? x.category_id === f.category_id : x.indicator_id === f.indicator_id),
      );
      if (hit) return hit;
    }
    throw e;
  }
}

/** Ensure the root folder exists, creating it (in My Drive) if not configured yet. */
export async function ensureRootFolder(): Promise<string> {
  const settings = await loadSettings();
  const drive = await getDrive();
  if (settings.driveRootFolderId) {
    const meta = await drive.getFile(settings.driveRootFolderId);
    if (meta && !meta.trashed) return settings.driveRootFolderId;
    throw new DriveError(
      "NOT_FOUND",
      "root folder missing — clear Root Folder ID in settings to let the system create a new one",
    );
  }
  const parent = isTestMode() ? "fake-root-parent" : null;
  const id = await drive.createFolder(settings.driveRootFolderName, parent);
  await getRepo().setSetting(SETTING_KEYS.driveRootFolderId, id);
  return id;
}

/**
 * Returns the Drive folder ID for an indicator, creating the category and
 * indicator folders on first use. Mappings are persisted so folders are
 * never duplicated; if a mapped folder was deleted in Drive it is recreated.
 */
export async function ensureIndicatorFolder(indicatorId: string): Promise<string> {
  const repo = getRepo();
  const rootId = await ensureRootFolder();
  const drive = await getDrive();
  const folders = await repo.listDriveFolders(rootId);

  const indicator = await repo.getIndicator(indicatorId);
  if (!indicator) throw new Error("indicator not found");
  const mapped = folders.find((f) => f.kind === "INDICATOR" && f.indicator_id === indicatorId);
  if (mapped) return mapped.drive_folder_id;

  const category = (await repo.listCategories()).find((c) => c.id === indicator.category_id);
  if (!category) throw new Error("category not found");

  let catFolder = folders.find((f) => f.kind === "CATEGORY" && f.category_id === category.id);
  if (!catFolder) {
    const name = categoryFolderName(category);
    const id = (await drive.findFolder(name, rootId)) ?? (await drive.createFolder(name, rootId));
    catFolder = await insertFolder(
      { kind: "CATEGORY", root_folder_id: rootId, category_id: category.id, indicator_id: null, drive_folder_id: id, name },
      folders,
    );
  }
  const name = indicatorFolderName(indicator);
  const id =
    (await drive.findFolder(name, catFolder.drive_folder_id)) ?? (await drive.createFolder(name, catFolder.drive_folder_id));
  const row = await insertFolder(
    { kind: "INDICATOR", root_folder_id: rootId, category_id: category.id, indicator_id: indicator.id, drive_folder_id: id, name },
    folders,
  );
  return row.drive_folder_id;
}

/** Create/repair the whole folder tree. Verifies mapped folders still exist and recreates missing ones. */
export async function syncFolderTree(): Promise<{ rootId: string; mapped: number; verified: number; repaired: number }> {
  const repo = getRepo();
  const drive = await getDrive();
  const rootId = await ensureRootFolder();
  let verified = 0;
  let repaired = 0;
  // verify mapped folders; drop stale mappings so ensureIndicatorFolder recreates them
  const stale: string[] = [];
  for (const f of await repo.listDriveFolders(rootId)) {
    const meta = await drive.getFile(f.drive_folder_id);
    if (!meta || meta.trashed) stale.push(f.id);
    else verified++;
  }
  if (stale.length) {
    // simplest consistent repair: rebuild mapping table for this root (folders are matched by name first, so no duplicates)
    await repo.deleteDriveFoldersForRoot(rootId);
    repaired = stale.length;
  }
  const indicators = (await repo.listIndicators()).filter((i) => i.is_active);
  for (const i of indicators) await ensureIndicatorFolder(i.id);
  const mapped = (await repo.listDriveFolders(rootId)).length;
  return { rootId, mapped, verified, repaired };
}
