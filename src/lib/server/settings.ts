import "server-only";
import { DEFAULT_ALLOWED_MIME, DEFAULT_LIMITS, type FileLimits } from "@/lib/shared/files";
import { getRepo } from "./backends";
import { env } from "./env";

export interface AppSettings {
  schoolName: string;
  schoolArea: string;
  systemName: string;
  systemNameEn: string;
  semester: string;
  academicYear: string;
  maxImageMb: number;
  maxVideoMb: number;
  maxFiles: number;
  allowedTypes: string[];
  publicDashboard: boolean;
  showRecentSubmitters: boolean;
  requireTurnstile: boolean;
  driveRootFolderName: string;
  driveRootFolderId: string;
}

export const SETTING_KEYS: Record<keyof AppSettings, string> = {
  schoolName: "school.name",
  schoolArea: "school.area",
  systemName: "system.name",
  systemNameEn: "system.name_en",
  semester: "term.semester",
  academicYear: "term.academic_year",
  maxImageMb: "upload.max_image_mb",
  maxVideoMb: "upload.max_video_mb",
  maxFiles: "upload.max_files",
  allowedTypes: "upload.allowed_types",
  publicDashboard: "display.public_dashboard",
  showRecentSubmitters: "display.show_recent_submitters",
  requireTurnstile: "security.require_turnstile",
  driveRootFolderName: "drive.root_folder_name",
  driveRootFolderId: "drive.root_folder_id",
};

export const SECRET_KEYS = {
  googleOAuth: "google.oauth",
  viewerCodeHash: "security.viewer_code_hash",
} as const;

export const DEFAULT_SETTINGS: AppSettings = {
  schoolName: "โรงเรียนบ้านโคกสูง",
  schoolArea: "สำนักงานเขตพื้นที่การศึกษาประถมศึกษาศรีสะเกษ เขต 3",
  systemName: "ระบบรวบรวมภาพและวิดีโอประกอบการนิเทศเปิดภาคเรียน",
  systemNameEn: "TeacherTemplate VTR Evidence Hub",
  semester: "2",
  academicYear: "2569",
  maxImageMb: DEFAULT_LIMITS.maxImageBytes / 1024 / 1024,
  maxVideoMb: DEFAULT_LIMITS.maxVideoBytes / 1024 / 1024,
  maxFiles: DEFAULT_LIMITS.maxFiles,
  allowedTypes: DEFAULT_ALLOWED_MIME,
  publicDashboard: true,
  showRecentSubmitters: false,
  requireTurnstile: true,
  driveRootFolderName: "VTR_นิเทศเปิดภาคเรียน_2_2569",
  driveRootFolderId: "",
};

export async function loadSettings(): Promise<AppSettings> {
  const rows = await getRepo().getSettings();
  const map = new Map(rows.filter((r) => !r.is_secret).map((r) => [r.key, r.value]));
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const [field, key] of Object.entries(SETTING_KEYS)) {
    if (map.has(key)) out[field] = map.get(key);
  }
  const s = out as unknown as AppSettings;
  if (!s.driveRootFolderId && env.googleDriveRootFolderId) s.driveRootFolderId = env.googleDriveRootFolderId;
  return s;
}

export async function getSecretSetting<T>(key: string): Promise<T | null> {
  const rows = await getRepo().getSettings();
  const row = rows.find((r) => r.key === key);
  return (row?.value as T) ?? null;
}

export function limitsFrom(s: AppSettings): FileLimits {
  return {
    maxImageBytes: Math.round(s.maxImageMb * 1024 * 1024),
    maxVideoBytes: Math.round(s.maxVideoMb * 1024 * 1024),
    maxFiles: s.maxFiles,
    allowedMime: s.allowedTypes,
  };
}
