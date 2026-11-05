import type { MediaType } from "./types";

export const MIME_EXTENSIONS: Record<string, string[]> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "video/mp4": ["mp4", "m4v"],
  "video/quicktime": ["mov"],
  "video/webm": ["webm"],
};

export const DEFAULT_ALLOWED_MIME = Object.keys(MIME_EXTENSIONS);

export const DEFAULT_LIMITS = {
  maxImageBytes: 20 * 1024 * 1024,
  maxVideoBytes: 500 * 1024 * 1024,
  maxFiles: 20,
};

/**
 * Chunk size for proxying uploads to Google Drive. Must be a multiple of
 * 256 KiB (Drive requirement) and stay below Vercel's 4.5 MB request body limit.
 */
export const CHUNK_SIZE = 15 * 256 * 1024; // 3,932,160 bytes (3.75 MiB)

export function mediaTypeOf(mime: string): MediaType | null {
  if (mime.startsWith("image/")) return "IMAGE";
  if (mime.startsWith("video/")) return "VIDEO";
  return null;
}

export function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Guess MIME from extension when the browser gives an empty/odd type (common on mobile for .mov). */
export function mimeFromName(name: string): string | null {
  const ext = extensionOf(name);
  for (const [mime, exts] of Object.entries(MIME_EXTENSIONS)) if (exts.includes(ext)) return mime;
  return null;
}

export interface FileCheckInput {
  name: string;
  size: number;
  type: string;
}

export interface FileLimits {
  maxImageBytes: number;
  maxVideoBytes: number;
  maxFiles: number;
  allowedMime: string[];
}

export type FileCheckResult = { ok: true; mime: string; mediaType: MediaType } | { ok: false; error: string };

/** Metadata-level validation shared by client and server. Content sniffing happens server-side. */
export function checkFileMeta(f: FileCheckInput, limits: FileLimits): FileCheckResult {
  const byName = mimeFromName(f.name);
  if (!byName) return { ok: false, error: `ไม่รองรับไฟล์ "${f.name}" (รองรับ JPG, JPEG, PNG, WEBP, MP4, MOV, WEBM)` };
  const declared = f.type && MIME_EXTENSIONS[f.type] ? f.type : byName;
  if (mediaTypeOf(declared) !== mediaTypeOf(byName)) {
    return { ok: false, error: `นามสกุลและชนิดของไฟล์ "${f.name}" ไม่ตรงกัน` };
  }
  if (!limits.allowedMime.includes(declared)) {
    return { ok: false, error: `ระบบไม่อนุญาตไฟล์ชนิด ${declared}` };
  }
  const mediaType = mediaTypeOf(declared)!;
  if (!Number.isFinite(f.size) || f.size <= 0) return { ok: false, error: `ไฟล์ "${f.name}" ว่างเปล่า` };
  const max = mediaType === "IMAGE" ? limits.maxImageBytes : limits.maxVideoBytes;
  if (f.size > max) {
    return { ok: false, error: `ไฟล์ "${f.name}" มีขนาด ${formatBytes(f.size)} เกินกำหนด ${formatBytes(max)}` };
  }
  return { ok: true, mime: declared, mediaType };
}

/**
 * Detect real file type from its first bytes (magic numbers).
 * Returns a MIME type or null if unknown / not allowed.
 */
export function sniffMime(head: Uint8Array): string | null {
  const b = head;
  const at = (i: number, bytes: number[]) => bytes.every((v, k) => b[i + k] === v);
  const ascii = (i: number, s: string) => at(i, [...s].map((c) => c.charCodeAt(0)));
  if (b.length >= 3 && at(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (b.length >= 8 && at(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (b.length >= 12 && ascii(0, "RIFF") && ascii(8, "WEBP")) return "image/webp";
  if (b.length >= 4 && at(0, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  if (b.length >= 12 && ascii(4, "ftyp")) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (brand === "qt  ") return "video/quicktime";
    return "video/mp4"; // isom, mp41, mp42, avc1, M4V , 3gp*, heic is excluded below
  }
  if (b.length >= 8 && (ascii(4, "moov") || ascii(4, "wide") || ascii(4, "mdat") || ascii(4, "free"))) {
    return "video/quicktime";
  }
  return null;
}

/** Whether a sniffed MIME is compatible with the declared MIME (mp4/mov share the ISO container). */
export function sniffMatches(declared: string, sniffed: string | null): boolean {
  if (!sniffed) return false;
  if (declared === sniffed) return true;
  const iso = ["video/mp4", "video/quicktime"];
  return iso.includes(declared) && iso.includes(sniffed);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ["KB", "MB", "GB"];
  let v = n / 1024;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u++;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[u]}`;
}

/** Strip path components and control characters from a user-supplied file name. */
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "_").trim();
  return (cleaned || "file").slice(0, 200);
}
