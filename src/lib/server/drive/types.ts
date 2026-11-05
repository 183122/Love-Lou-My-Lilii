export type DriveErrorCode =
  | "NOT_CONFIGURED"
  | "NOT_CONNECTED"
  | "TOKEN_REVOKED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "SESSION_EXPIRED"
  | "QUOTA"
  | "NETWORK"
  | "UNKNOWN";

const HINTS: Record<DriveErrorCode, string> = {
  NOT_CONFIGURED: "ยังไม่ได้ตั้งค่า GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET บนเซิร์ฟเวอร์ — ดูคู่มือ docs/GOOGLE_OAUTH_SETUP.md",
  NOT_CONNECTED: "ยังไม่ได้เชื่อมต่อ Google Drive — ผู้ดูแลต้องไปที่ ตั้งค่าระบบ › Google Drive แล้วกด “เชื่อมต่อ Google Drive”",
  TOKEN_REVOKED:
    "สิทธิ์ Google Drive หมดอายุหรือถูกเพิกถอน — ผู้ดูแลต้องกด “เชื่อมต่อใหม่” ในหน้า ตั้งค่าระบบ › Google Drive (หากแอป OAuth อยู่ในสถานะ Testing โทเคนจะหมดอายุใน 7 วัน)",
  FORBIDDEN:
    "บัญชี Google ที่เชื่อมต่อไม่มีสิทธิ์เขียนโฟลเดอร์นี้ — ตรวจสอบว่าเป็นเจ้าของหรือผู้แก้ไขโฟลเดอร์ หรือหากใช้ขอบเขต drive.file ต้องให้ระบบสร้างโฟลเดอร์หลักเอง",
  NOT_FOUND: "ไม่พบไฟล์หรือโฟลเดอร์ใน Google Drive (อาจถูกลบ หรือบัญชีที่เชื่อมต่อไม่มีสิทธิ์เข้าถึง)",
  SESSION_EXPIRED: "เซสชันอัปโหลดของ Google Drive หมดอายุ ระบบจะเริ่มอัปโหลดไฟล์นี้ใหม่",
  QUOTA: "พื้นที่ Google Drive เต็มหรือเกินโควตา API — ตรวจสอบพื้นที่เก็บข้อมูลของบัญชี",
  NETWORK: "เชื่อมต่อ Google Drive ไม่ได้ชั่วคราว กรุณาลองใหม่อีกครั้ง",
  UNKNOWN: "เกิดข้อผิดพลาดจาก Google Drive กรุณาลองใหม่ หากยังพบปัญหาให้แจ้งผู้ดูแล",
};

export class DriveError extends Error {
  constructor(
    public code: DriveErrorCode,
    public detail?: string,
    public httpStatus?: number,
  ) {
    super(HINTS[code]);
    this.name = "DriveError";
  }
}

export interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  md5Checksum?: string;
  trashed?: boolean;
  parents?: string[];
  thumbnailLink?: string;
  webViewLink?: string;
  capabilities?: { canAddChildren?: boolean; canEdit?: boolean };
}

export type ChunkResult = { done: false; committed: number } | { done: true; file: { id: string; md5Checksum?: string } };

export interface DriveClient {
  readonly kind: "google" | "fake";
  about(): Promise<{ email: string; name: string }>;
  getFile(id: string): Promise<DriveFileMeta | null>;
  findFolder(name: string, parentId: string): Promise<string | null>;
  createFolder(name: string, parentId: string | null): Promise<string>;
  initResumableUpload(input: { name: string; mimeType: string; parentId: string; size: number }): Promise<string>;
  uploadChunk(sessionUrl: string, chunk: Uint8Array, start: number, total: number): Promise<ChunkResult>;
  queryUploadStatus(sessionUrl: string, total: number): Promise<ChunkResult>;
  download(id: string, range?: string | null): Promise<Response>;
  thumbnail(id: string): Promise<Response | null>;
  trash(id: string): Promise<void>;
}
