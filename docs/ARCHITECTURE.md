# Architecture & Security Design

## ภาพรวม
```
Browser ──HTTPS──▶ Next.js Route Handlers (Vercel) ──▶ Supabase Postgres (service role, RLS deny-all)
                                   │
                                   └──▶ Google Drive API v3 (OAuth refresh token, server-only)
```
Browser ไม่ติดต่อ Supabase หรือ Google โดยตรง

## การอัปโหลด (Resumable, ผ่านเซิร์ฟเวอร์ทีละ chunk)
1. `POST /api/submissions` — rate limit + Turnstile + zod + ตรวจชนิด/ขนาด/จำนวนไฟล์ → ตรวจว่า Drive ใช้งานได้และมีโฟลเดอร์ตัวชี้วัด → สร้าง `submissions` และ `evidence_files` (สถานะ PENDING) → คืน `uploadToken` (HMAC, อายุ 48 ชม., ผูกกับไฟล์เดียว)
2. `PUT /api/uploads/:id` (Content-Range, ≤ 3.75 MiB) — chunk แรกตรวจ **magic bytes** ว่าเป็น JPEG/PNG/WEBP/MP4/MOV/WEBM จริง → เซิร์ฟเวอร์เริ่ม **Google Drive resumable session** (URL เก็บใน DB เท่านั้น ไม่ส่งให้ Browser และส่งได้เฉพาะโฮสต์ `www.googleapis.com/upload/drive/`) → ส่งต่อ chunk → บันทึก bytes ที่ Drive ยืนยัน
3. Chunk สุดท้าย: Drive คืน File ID → บันทึก `drive_file_id`, `md5`, สถานะ `UPLOADED`
4. `GET /api/uploads/:id` — ถาม Drive ว่ารับไปแล้วกี่ byte เพื่อ **อัปโหลดต่อ** หลังเน็ตหลุด

ทำไมไม่ให้ Browser ส่งตรงไป Drive: resumable session URL ทำหน้าที่เป็น credential ใครได้ URL ก็เขียนไฟล์ได้ และระบบจะตรวจเนื้อหาไฟล์ไม่ได้ จึงให้เซิร์ฟเวอร์ถือ URL ไว้และตรวจทุก chunk แทน — แลกกับปริมาณ bandwidth ที่ผ่าน Vercel (ไม่เกิน 4.5 MB ต่อคำขอ จึงไม่ติดข้อจำกัด และไม่ buffer ทั้งไฟล์)

**กันข้อมูลซ้ำ / Retry:** `client_upload_id` (unique) สร้างที่ Browser ส่งซ้ำได้คืนรายการเดิม; chunk ที่ offset ไม่ตรงได้ 409 + offset ที่ถูกต้อง; ไฟล์ที่ UPLOADED แล้วส่งซ้ำไม่สร้างไฟล์ใหม่; session หมดอายุ (404/410) เริ่มใหม่อัตโนมัติ; ไฟล์ล้มเหลว = `FAILED` ไม่ถูกนับ
**Auto-retry ฝั่ง Browser:** เฉพาะเน็ตหลุด/5xx ชั่วคราว (backoff 1→16 วิ, 5 ครั้ง) — ปัญหาสิทธิ์/โทเคนแสดงทันทีพร้อมปุ่ม “ลองใหม่”

## การเข้าถึงไฟล์
`GET /api/files/:id/content` — ต้องมี session ผู้ชม/ผู้ดูแล → stream จาก Drive (รองรับ Range สำหรับ seek วิดีโอ) พร้อม `Content-Security-Policy: sandbox`, `nosniff` — ไม่ตั้งไฟล์เป็น Public ใน Drive
ถ้า Drive ตอบ 404 → ไฟล์ถูกทำเครื่องหมาย `MISSING` และสถานะตัวชี้วัดคำนวณใหม่ทันที (และมีปุ่ม “ตรวจสอบไฟล์กับ Google Drive” ตรวจทั้งหมด)

## ZIP
ไม่สร้าง ZIP บน Serverless: วิดีโอรวมหลาย GB เกินหน่วยความจำ/เวลา/ขนาด response ของ Vercel แทนที่ด้วย (1) ดาวน์โหลดทีละไฟล์จากหน้า VTR (2) Manifest CSV/JSON (3) ดาวน์โหลดโฟลเดอร์ผ่าน Google Drive ซึ่ง Drive บีบอัดให้เอง หากต้องการ ZIP อัตโนมัติในอนาคต ให้ใช้ Background worker (เช่น Cloud Run job) ที่อ่านจาก Drive แล้วเขียน ZIP กลับไปที่ Drive

## สิทธิ์
| บทบาท | ทำได้ |
|---|---|
| ผู้ส่ง (ไม่ login) | ดู Dashboard สถิติ (ไม่มีชื่อผู้ส่ง/ไฟล์), ดูตัวชี้วัด, ส่งหลักฐาน |
| ผู้ชม (รหัสเข้าถึง) | + ดูและดาวน์โหลดหลักฐาน |
| ผู้ดูแล (รหัสผ่าน) | + จัดการตัวชี้วัด/ไฟล์/VTR/Drive/ตั้งค่า/ลบ |

## มาตรการความปลอดภัย
- รหัสผ่าน scrypt hash; session token สุ่ม 256-bit เก็บเฉพาะ SHA-256; Cookie `HttpOnly; Secure; SameSite=Lax` (`__Host-` prefix บน HTTPS); อายุ 8 ชม. (ผู้ดูแล) / 7 วัน (ผู้ชม)
- CSRF: header `x-csrf-token` ผูกกับ session + ตรวจ Origin ทุกคำขอที่เปลี่ยนข้อมูล; OAuth `state` ลงนามและผูกกับ session
- Rate limiting ใน Postgres (ใช้ร่วมกันทุก instance): login 5/15 นาที, viewer 10/15 นาที, submission 15/ชม., chunk 3000/ชม., file read 1500/ชม. ต่อ IP
- Cloudflare Turnstile บนฟอร์มสาธารณะ (ระบบปฏิเสธการส่งถ้าบังคับ CAPTCHA แต่ไม่ได้ตั้งคีย์)
- zod validation ทุก input, จำกัดขนาด JSON, sanitize ชื่อไฟล์, CSV formula injection protection
- Security headers: HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy
- ข้อผิดพลาดถูก log ฝั่งเซิร์ฟเวอร์ (`console.error` → Vercel Logs) และส่งข้อความที่ปลอดภัยให้ผู้ใช้
