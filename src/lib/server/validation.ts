import { z } from "zod";

const text = (max: number, label: string, min = 1) =>
  z
    .string({ error: `กรุณากรอก${label}` })
    .trim()
    .min(min, `กรุณากรอก${label}`)
    .max(max, `${label}ยาวเกิน ${max} ตัวอักษร`);

export const fileMetaSchema = z.object({
  clientUploadId: z.string().regex(/^[A-Za-z0-9_-]{8,100}$/, "รหัสไฟล์ไม่ถูกต้อง"),
  name: z.string().min(1).max(255),
  size: z.number().int().positive(),
  type: z.string().max(100).default(""),
});

export const submissionSchema = z.object({
  indicatorId: z.uuid("กรุณาเลือกตัวชี้วัด"),
  submitterName: text(150, "ชื่อผู้ส่ง"),
  submitterPosition: text(150, "ตำแหน่ง"),
  activityTitle: text(300, "ชื่อกิจกรรม"),
  activityDetail: z.string().trim().max(5000, "รายละเอียดกิจกรรมยาวเกินไป").default(""),
  activityDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "กรุณาระบุวันที่จัดกิจกรรม")
    .refine((d) => !Number.isNaN(Date.parse(d)), "วันที่ไม่ถูกต้อง"),
  note: z.string().trim().max(2000, "หมายเหตุยาวเกินไป").default(""),
  turnstileToken: z.string().max(4096).optional(),
  files: z.array(fileMetaSchema).min(1, "กรุณาแนบรูปภาพหรือวิดีโออย่างน้อย 1 ไฟล์").max(100),
});

const code = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9_]{0,15}$/, "รหัสต้องขึ้นต้นด้วยตัวอักษรภาษาอังกฤษ เช่น A01");

export const categoryInputSchema = z.object({
  code,
  name: text(200, "ชื่อหมวด"),
  name_en: z.string().trim().max(200).default(""),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "สีไม่ถูกต้อง").default("#38bdf8"),
  sort_order: z.number().int().min(0).max(10000).default(0),
  is_active: z.boolean().default(true),
});

export const indicatorInputSchema = z.object({
  code,
  category_id: z.uuid("กรุณาเลือกหมวด"),
  title: text(300, "ชื่อตัวชี้วัด"),
  description: z.string().trim().max(2000).default(""),
  recommended_evidence: z.string().trim().max(2000).default(""),
  required_image_count: z.number().int().min(0).max(100),
  required_video_count: z.number().int().min(0).max(100),
  sort_order: z.number().int().min(0).max(10000).default(0),
  is_active: z.boolean().default(true),
});

export const MIME_ALLOWED_SET = ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/quicktime", "video/webm"] as const;

export const settingsInputSchema = z
  .object({
    schoolName: text(200, "ชื่อโรงเรียน"),
    schoolArea: z.string().trim().max(300),
    systemName: text(200, "ชื่อระบบ"),
    systemNameEn: z.string().trim().max(200),
    semester: z.string().trim().regex(/^[1-3]$/, "ภาคเรียนต้องเป็น 1–3"),
    academicYear: z.string().trim().regex(/^25\d\d$/, "ปีการศึกษาต้องเป็นปี พ.ศ. เช่น 2569"),
    maxImageMb: z.number().min(1).max(100),
    maxVideoMb: z.number().min(1).max(5000),
    maxFiles: z.number().int().min(1).max(50),
    allowedTypes: z.array(z.enum(MIME_ALLOWED_SET)).min(1, "ต้องอนุญาตไฟล์อย่างน้อย 1 ชนิด"),
    publicDashboard: z.boolean(),
    showRecentSubmitters: z.boolean(),
    requireTurnstile: z.boolean(),
    driveRootFolderName: text(200, "ชื่อโฟลเดอร์หลัก"),
    driveRootFolderId: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9_-]{0,200}$/, "Root Folder ID ไม่ถูกต้อง"),
  })
  .partial();
