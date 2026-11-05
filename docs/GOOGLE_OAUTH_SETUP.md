# Google OAuth & Google Drive Setup Guide

ผู้ส่งหลักฐาน **ไม่ต้อง** มีบัญชี Google — ผู้ดูแลเชื่อม Drive ของโรงเรียนครั้งเดียว ไฟล์ทั้งหมดจะเข้า Drive บัญชีนั้น

## 1. สร้าง Google Cloud Project
https://console.cloud.google.com → เลือกโปรเจกต์ → **New Project** (เช่น `vtr-evidence-hub`)

## 2. เปิด Google Drive API
**APIs & Services → Library** → ค้นหา **Google Drive API** → **Enable**

## 3. ตั้งค่า OAuth Consent Screen
**APIs & Services → OAuth consent screen** (Google Auth Platform)
- User type: **Internal** หากโรงเรียนใช้ Google Workspace (แนะนำ ไม่มีการหมดอายุ 7 วัน) มิฉะนั้นเลือก **External**
- App name, support email, developer email
- Scopes: `.../auth/drive.file`, `openid`, `email`
- ถ้าเป็น External: เพิ่มอีเมลเจ้าของ Drive ใน **Test users** และ**กด Publish app** (In production) เมื่อพร้อมใช้งานจริง

> ⚠️ แอป External ที่อยู่ในสถานะ *Testing* — refresh token จะหมดอายุทุก 7 วัน ระบบจะแสดงข้อความ “สิทธิ์ Google Drive หมดอายุ” และผู้ดูแลต้องกดเชื่อมต่อใหม่ แนะนำให้ Publish หรือใช้ Internal
> scope `drive.file` จัดเป็น non-sensitive จึงไม่ต้องผ่านการ verify ของ Google

## 4. สร้าง OAuth Client
**Credentials → Create credentials → OAuth client ID**
- Application type: **Web application**
- Authorized redirect URIs:
  - `https://<โดเมนจริง>/api/admin/drive/callback`
  - (สำหรับพัฒนา) `http://localhost:3000/api/admin/drive/callback`
- คัดลอก Client ID → `GOOGLE_CLIENT_ID`, Client secret → `GOOGLE_CLIENT_SECRET`

`NEXT_PUBLIC_APP_URL` ต้องตรงกับโดเมนใน Redirect URI ทุกตัวอักษร (ไม่มี `/` ท้าย)

## 5. สิทธิ์ (Scope) ที่ใช้
- ค่าเริ่มต้น `drive.file` — สิทธิ์น้อยที่สุด แอปเข้าถึงได้เฉพาะไฟล์/โฟลเดอร์ที่แอปสร้างเอง ระบบจะสร้างโฟลเดอร์หลัก `VTR_นิเทศเปิดภาคเรียน_2_2569` ให้
- หากต้องการใช้โฟลเดอร์ที่มีอยู่แล้ว (สร้างเองนอกระบบ / Shared Drive) ให้ตั้ง `GOOGLE_DRIVE_SCOPE=drive` แล้วใส่ Root Folder ID — ต้องเพิ่ม scope `.../auth/drive` ใน consent screen (เป็น restricted scope)

## 6. เชื่อม Google Drive
1. Deploy และตั้ง Environment Variables ให้ครบ
2. เข้า `/settings` ด้วยรหัสผ่านผู้ดูแล → แท็บ **Google Drive** → **เชื่อมต่อ Google Drive**
3. เลือกบัญชีเจ้าของ Drive และอนุญาต
4. กลับมาที่หน้า Settings → กด **สร้าง/ซ่อมโครงสร้างโฟลเดอร์** จะได้
   ```
   VTR_นิเทศเปิดภาคเรียน_2_2569/
     A. การบริหารงานทั่วไป/
       A01 ประชุมครูก่อนเปิดภาคเรียน/
       ...
     B. การบริหารงานวิชาการ/
     ... (7 หมวด, 36 โฟลเดอร์ตัวชี้วัด)
   ```
   (ถ้าไม่กด ระบบจะสร้างให้อัตโนมัติเมื่อมีการส่งหลักฐานครั้งแรกของตัวชี้วัดนั้น)
5. สถานะในหน้านี้ตรวจสอบกับ Google จริงทุกครั้ง (บัญชี, โฟลเดอร์หลัก, สิทธิ์เขียน, จำนวนโฟลเดอร์)

Refresh token เก็บฝั่งเซิร์ฟเวอร์แบบเข้ารหัสเท่านั้น ไม่ถูกส่งไป Browser ไม่อยู่ใน LocalStorage ไฟล์ไม่ถูกตั้งเป็น Public

## การแก้ปัญหา
| อาการ | สาเหตุ/วิธีแก้ |
|---|---|
| `redirect_uri_mismatch` | Redirect URI ใน Console ไม่ตรงกับ `NEXT_PUBLIC_APP_URL/api/admin/drive/callback` |
| “สิทธิ์ Google Drive หมดอายุหรือถูกเพิกถอน” | กดเชื่อมต่อใหม่ / Publish แอป / ตรวจว่าไม่ได้เปลี่ยน `SESSION_SECRET` หรือ `TOKEN_ENCRYPTION_KEY` |
| “ไม่มีสิทธิ์เขียนโฟลเดอร์นี้” | บัญชีที่เชื่อมไม่ใช่เจ้าของ/ผู้แก้ไข หรือใช้ `drive.file` กับโฟลเดอร์ที่ไม่ได้สร้างโดยแอป → ล้าง Root Folder ID |
| “ไม่ได้รับ refresh token” | เพิกถอนสิทธิ์แอปที่ https://myaccount.google.com/permissions แล้วเชื่อมใหม่ |
| “ไม่พบโฟลเดอร์หลัก” | โฟลเดอร์ถูกลบ → ล้าง Root Folder ID ให้ระบบสร้างใหม่ |

## ทดสอบกับ Drive จริง
```bash
GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=... npm run test:drive-live
```
(สร้างโฟลเดอร์ชั่วคราว อัปโหลดแบบ resumable 2 chunk ดาวน์โหลดแบบ Range แล้วย้ายไปถังขยะ)
